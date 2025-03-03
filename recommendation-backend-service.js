// src/services/recommendationService.js
const db = require('../config/database');
const contentService = require('./contentService');
const userService = require('./userService');
const { calculateSimilarity } = require('../utils/mathUtils');

/**
 * Recommendation Service
 * Provides methods to generate different types of recommendations
 */
const recommendationService = {
  /**
   * Get personalized recommendations using collaborative filtering
   * @param {string} userId - User ID
   * @param {Object} options - Options for filtering recommendations
   * @param {number} options.limit - Maximum number of recommendations to return
   * @param {Array} options.excludeIds - Content IDs to exclude
   * @param {Array} options.genres - Filter by genres
   * @returns {Promise<Array>} Array of recommended content
   */
  async getCollaborativeRecommendations(userId, options = {}) {
    const { limit = 10, excludeIds = [], genres = [] } = options;
    
    try {
      // 1. Get user's ratings and watched status
      const userRatings = await db.userRatings.findAll({ 
        where: { userId },
        include: [{ model: db.content, attributes: ['id', 'genres'] }]
      });
      
      if (userRatings.length < 3) {
        // Not enough data for meaningful collaborative filtering
        return this.getPopularRecommendations(options);
      }
      
      // 2. Find similar users based on rating patterns
      const similarUsers = await this._findSimilarUsers(userId, userRatings);
      
      // 3. Get content liked by similar users but not yet seen by current user
      const recommendations = await this._getContentFromSimilarUsers(
        userId, 
        similarUsers,
        excludeIds
      );
      
      // 4. Apply additional filters
      let filteredRecs = recommendations;
      if (genres.length > 0) {
        filteredRecs = recommendations.filter(item => {
          const contentGenres = item.content.genres || [];
          return genres.some(g => contentGenres.includes(g));
        });
      }
      
      // 5. Sort by score and limit results
      const results = filteredRecs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      // 6. Fetch full content details and add recommendation type
      const contentIds = results.map(r => r.contentId);
      const fullContent = await contentService.getContentByIds(contentIds);
      
      return fullContent.map(content => ({
        ...content,
        recommendationType: 'collaborative'
      }));
    } catch (error) {
      console.error('Error getting collaborative recommendations:', error);
      return [];
    }
  },
  
  /**
   * Get content-based recommendations based on genres, actors, directors
   * @param {string} userId - User ID
   * @param {Object} options - Options for filtering recommendations
   * @returns {Promise<Array>} Array of recommended content
   */
  async getContentBasedRecommendations(userId, options = {}) {
    const { limit = 10, excludeIds = [] } = options;
    
    try {
      // 1. Get user's highly rated content
      const userFavorites = await db.userRatings.findAll({
        where: {
          userId,
          rating: { [db.Sequelize.Op.gte]: 4.0 } // 4 stars or higher
        },
        include: [{ 
          model: db.content,
          include: [
            { model: db.genre },
            { model: db.person, as: 'directors' },
            { model: db.person, as: 'actors' }
          ]
        }]
      });
      
      if (userFavorites.length === 0) {
        return this.getPopularRecommendations(options);
      }
      
      // 2. Extract metadata from favorite content
      const favoriteGenres = {};
      const favoriteDirectors = {};
      const favoriteActors = {};
      
      userFavorites.forEach(rating => {
        const content = rating.content;
        
        // Count genre frequencies
        content.genres.forEach(genre => {
          favoriteGenres[genre.id] = (favoriteGenres[genre.id] || 0) + 1;
        });
        
        // Count director frequencies
        content.directors.forEach(director => {
          favoriteDirectors[director.id] = (favoriteDirectors[director.id] || 0) + 1;
        });
        
        // Count actor frequencies
        content.actors.forEach(actor => {
          favoriteActors[actor.id] = (favoriteActors[actor.id] || 0) + 1;
        });
      });
      
      // 3. Find content with similar attributes but not yet consumed
      const userContentIds = await userService.getUserContentIds(userId);
      const allExcludeIds = [...userContentIds, ...excludeIds];
      
      // 4. Calculate scores for potential recommendations
      const contentScores = await this._scoreContentByAttributes(
        favoriteGenres,
        favoriteDirectors,
        favoriteActors,
        allExcludeIds,
        limit * 3 // Fetch more to filter
      );
      
      // 5. Sort and limit results
      const results = contentScores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      // 6. Fetch full content details
      const contentIds = results.map(r => r.contentId);
      const fullContent = await contentService.getContentByIds(contentIds);
      
      return fullContent.map(content => ({
        ...content,
        recommendationType: 'content-based'
      }));
    } catch (error) {
      console.error('Error getting content-based recommendations:', error);
      return [];
    }
  },
  
  /**
   * Get similar content recommendations based on a specific content item
   * @param {string} contentId - Content ID to find similar items for
   * @param {Object} options - Options for filtering recommendations
   * @returns {Promise<Array>} Array of similar content
   */
  async getSimilarContentRecommendations(contentId, options = {}) {
    const { limit = 10, userId = null } = options;
    
    try {
      // 1. Get content details with genres, actors, directors
      const content = await contentService.getContentById(contentId, {
        includeGenres: true,
        includeActors: true,
        includeDirectors: true
      });
      
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`);
      }
      
      // 2. Prepare attributes to match
      const genreIds = content.genres.map(g => g.id);
      const directorIds = content.directors.map(d => d.id);
      const actorIds = content.actors.map(a => a.id);
      
      // 3. Find similar content
      const excludeIds = [contentId];
      if (userId) {
        const userContentIds = await userService.getUserContentIds(userId);
        excludeIds.push(...userContentIds);
      }
      
      // 4. Query for similar content
      const similarContent = await db.content.findAll({
        where: {
          id: { [db.Sequelize.Op.notIn]: excludeIds }
        },
        include: [
          { 
            model: db.genre,
            where: { id: { [db.Sequelize.Op.in]: genreIds } }
          },
          // Optional includes for actors and directors for scoring
          { model: db.person, as: 'directors' },
          { model: db.person, as: 'actors' }
        ],
        limit: limit * 3 // Get more for scoring and filtering
      });
      
      // 5. Score similarity
      const scoredContent = similarContent.map(similar => {
        let score = 0;
        
        // Genre match score (highest weight)
        const matchedGenres = similar.genres.filter(g => 
          genreIds.includes(g.id)
        ).length;
        score += (matchedGenres / genreIds.length) * 50;
        
        // Director match score
        const matchedDirectors = similar.directors.filter(d => 
          directorIds.includes(d.id)
        ).length;
        score += (matchedDirectors > 0) ? 30 : 0;
        
        // Actor match score
        const matchedActors = similar.actors.filter(a => 
          actorIds.includes(a.id)
        ).length;
        score += Math.min((matchedActors / 3) * 20, 20); // Cap at 20 points
        
        return {
          contentId: similar.id,
          score
        };
      });
      
      // 6. Sort and limit
      const results = scoredContent
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      // 7. Fetch full content details
      const contentIds = results.map(r => r.contentId);
      const fullContent = await contentService.getContentByIds(contentIds);
      
      return fullContent.map(content => ({
        ...content,
        recommendationType: 'similar'
      }));
    } catch (error) {
      console.error('Error getting similar content recommendations:', error);
      return [];
    }
  },
  
  /**
   * Get popular or trending content recommendations
   * @param {Object} options - Options for filtering recommendations
   * @returns {Promise<Array>} Array of popular content
   */
  async getPopularRecommendations(options = {}) {
    const { limit = 10, excludeIds = [], timeframe = 'month' } = options;
    
    try {
      // Query for popular content based on user activities
      const popularContent = await db.content.findAll({
        where: {
          id: { [db.Sequelize.Op.notIn]: excludeIds }
        },
        attributes: {
          include: [
            [
              db.sequelize.literal(`(
                SELECT COUNT(*) FROM user_content_status
                WHERE content_id = content.id
                AND status = 'completed'
                AND updated_at > NOW() - INTERVAL '1 ${timeframe}'
              )`),
              'popularityScore'
            ]
          ]
        },
        order: [[db.sequelize.literal('popularityScore'), 'DESC']],
        limit
      });
      
      return popularContent.map(content => ({
        ...content.toJSON(),
        recommendationType: 'popular'
      }));
    } catch (error) {
      console.error('Error getting popular recommendations:', error);
      return [];
    }
  },
  
  /**
   * Get discovery recommendations outside user's usual preferences
   * @param {string} userId - User ID
   * @param {Object} options - Options for filtering recommendations
   * @returns {Promise<Array>} Array of discovery content
   */
  async getDiscoveryRecommendations(userId, options = {}) {
    const { limit = 10 } = options;
    
    try {
      // 1. Get user's favorite genres
      const userGenres = await this._getUserPreferredGenres(userId);
      
      if (userGenres.length === 0) {
        return this.getPopularRecommendations(options);
      }
      
      // 2. Find genres not in user's top preferences
      const allGenres = await db.genre.findAll();
      const discoveryGenres = allGenres
        .filter(genre => !userGenres.includes(genre.id))
        .map(genre => genre.id);
      
      if (discoveryGenres.length === 0) {
        // User has watched all genres, use highly rated but less popular content
        return this._getHighlyRatedUnpopularContent(userId, limit);
      }
      
      // 3. Get content from non-preferred genres that is highly rated
      const userContentIds = await userService.getUserContentIds(userId);
      
      const discoveryContent = await db.content.findAll({
        where: {
          id: { [db.Sequelize.Op.notIn]: userContentIds },
          average_rating: { [db.Sequelize.Op.gte]: 4.0 }
        },
        include: [
          {
            model: db.genre,
            where: { id: { [db.Sequelize.Op.in]: discoveryGenres } }
          }
        ],
        order: [['average_rating', 'DESC']],
        limit
      });
      
      return discoveryContent.map(content => ({
        ...content.toJSON(),
        recommendationType: 'discovery'
      }));
    } catch (error) {
      console.error('Error getting discovery recommendations:', error);
      return [];
    }
  },
  
  /**
   * Find users with similar taste to the current user
   * @private
   */
  async _findSimilarUsers(userId, userRatings) {
    // Get all users who rated some of the same content
    const userRatingMap = {};
    userRatings.forEach(rating => {
      userRatingMap[rating.contentId] = rating.rating;
    });
    
    const contentIds = Object.keys(userRatingMap);
    
    // Find other users who rated the same content
    const otherUserRatings = await db.userRatings.findAll({
      where: {
        contentId: { [db.Sequelize.Op.in]: contentIds },
        userId: { [db.Sequelize.Op.ne]: userId }
      }
    });
    
    // Group ratings by user
    const userRatingsMap = {};
    otherUserRatings.forEach(rating => {
      if (!userRatingsMap[rating.userId]) {
        userRatingsMap[rating.userId] = {};
      }
      userRatingsMap[rating.userId][rating.contentId] = rating.rating;
    });
    
    // Calculate similarity scores
    const similarityScores = [];
    for (const [otherUserId, ratings] of Object.entries(userRatingsMap)) {
      // Find content rated by both users
      const commonContentIds = Object.keys(ratings).filter(
        contentId => userRatingMap.hasOwnProperty(contentId)
      );
      
      if (commonContentIds.length < 3) {
        // Not enough common ratings
        continue;
      }
      
      // Extract rating vectors
      const currentUserVector = commonContentIds.map(id => userRatingMap[id]);
      const otherUserVector = commonContentIds.map(id => ratings[id]);
      
      // Calculate cosine similarity
      const similarity = calculateSimilarity(currentUserVector, otherUserVector);
      
      if (similarity > 0.5) { // Threshold for similarity
        similarityScores.push({
          userId: otherUserId,
          similarity
        });
      }
    }
    
    // Return the most similar users
    return similarityScores
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  },
  
  /**
   * Get content from similar users not yet seen by current user
   * @private
   */
  async _getContentFromSimilarUsers(userId, similarUsers, excludeIds) {
    // Get content already seen by current user
    const userContentIds = await userService.getUserContentIds(userId);
    const allExcludeIds = [...userContentIds, ...excludeIds];
    
    // Get highly rated content from similar users
    const recommendations = [];
    const recommendedContentMap = {};
    
    // Get ratings from similar users
    const similarUserIds = similarUsers.map(u => u.userId);
    const similarUsersRatings = await db.userRatings.findAll({
      where: {
        userId: { [db.Sequelize.Op.in]: similarUserIds },
        contentId: { [db.Sequelize.Op.notIn]: allExcludeIds },
        rating: { [db.Sequelize.Op.gte]: 4.0 } // Only highly rated content
      }
    });
    
    // Score recommendations by similarity and rating
    similarUsersRatings.forEach(rating => {
      const similarUser = similarUsers.find(u => u.userId === rating.userId);
      const score = similarUser.similarity * (rating.rating / 5.0);
      
      if (recommendedContentMap[rating.contentId]) {
        recommendedContentMap[rating.contentId].score += score;
      } else {
        recommendedContentMap[rating.contentId] = {
          contentId: rating.contentId,
          score
        };
      }
    });
    
    // Convert map to array
    for (const contentId in recommendedContentMap) {
      recommendations.push(recommendedContentMap[contentId]);
    }
    
    return recommendations;
  },
  
  /**
   * Score content based on similarity to user's preferred attributes
   * @private
   */
  async _scoreContentByAttributes(favoriteGenres, favoriteDirectors, favoriteActors, excludeIds, limit) {
    // Get content not yet consumed by user
    const potentialContent = await db.content.findAll({
      where: {
        id: { [db.Sequelize.Op.notIn]: excludeIds }
      },
      include: [
        { model: db.genre },
        { model: db.person, as: 'directors' },
        { model: db.person, as: 'actors' }
      ],
      limit: limit * 2 // Get more for better filtering
    });
    
    // Score each content item
    return potentialContent.map(content => {
      let score = 0;
      
      // Genre matching (40% weight)
      content.genres.forEach(genre => {
        if (favoriteGenres[genre.id]) {
          score += (favoriteGenres[genre.id] * 8); // More weight for frequently liked genres
        }
      });
      
      // Director matching (30% weight)
      content.directors.forEach(director => {
        if (favoriteDirectors[director.id]) {
          score += (favoriteDirectors[director.id] * 15);
        }
      });
      
      // Actor matching (30% weight)
      content.actors.forEach(actor => {
        if (favoriteActors[actor.id]) {
          score += (favoriteActors[actor.id] * 6);
        }
      });
      
      return {
        contentId: content.id,
        score
      };
    });
  },
  
  /**
   * Get user's preferred genres based on their ratings and watches
   * @private
   */
  async _getUserPreferredGenres(userId) {
    // Get user's ratings
    const userRatings = await db.userRatings.findAll({
      where: { userId },
      include: [{ 
        model: db.content,
        include: [{ model: db.genre }]
      }]
    });
    
    // Count genre frequencies
    const genreCounts = {};
    userRatings.forEach(rating => {
      if (!rating.content || !rating.content.genres) return;
      
      rating.content.genres.forEach(genre => {
        // Weight by rating
        const weight = rating.rating >= 4 ? 2 : 1;
        genreCounts[genre.id] = (genreCounts[genre.id] || 0) + weight;
      });
    });
    
    // Sort genres by frequency
    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genreId]) => genreId);
    
    // Return top genres
    return sortedGenres.slice(0, 5);
  },
  
  /**
   * Get highly rated content that's not very popular
   * @private
   */
  async _getHighlyRatedUnpopularContent(userId, limit) {
    const userContentIds = await userService.getUserContentIds(userId);
    
    const content = await db.content.findAll({
      where: {
        id: { [db.Sequelize.Op.notIn]: userContentIds },
        average_rating: { [db.Sequelize.Op.gte]: 4.0 }
      },
      attributes: {
        include: [
          [
            db.sequelize.literal(`(
              SELECT COUNT(*) FROM user_content_status
              WHERE content_id = content.id
            )`),
            'popularity'
          ]
        ]
      },
      order: [
        ['average_rating', 'DESC'],
        [db.sequelize.literal('popularity'), 'ASC']
      ],
      limit
    });
    
    return content.map(c => ({
      ...c.toJSON(),
      recommendationType: 'discovery'
    }));
  }
};

module.exports = recommendationService;
