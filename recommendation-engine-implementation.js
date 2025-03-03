// models/userContentInteraction.js
// This model will track all user interactions with content for recommendation data
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserContentInteraction = sequelize.define('UserContentInteraction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    contentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Contents',
        key: 'id'
      }
    },
    interactionType: {
      type: DataTypes.ENUM('view', 'rate', 'add_to_list', 'comment'),
      allowNull: false
    },
    value: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'For ratings (1-5) or other numerical values'
    },
    status: {
      type: DataTypes.ENUM('watching', 'completed', 'plan_to_watch', 'dropped'),
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  return UserContentInteraction;
};

// services/recommendationService.js
const { Op } = require('sequelize');
const { User, Content, UserContentInteraction, UserList, Genre, ContentGenre } = require('../models');

/**
 * Recommendation Service
 * Implements collaborative and content-based filtering algorithms
 */
class RecommendationService {
  /**
   * Get personalized recommendations for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of recommendations to return
   * @returns {Promise<Array>} - Array of recommended content
   */
  async getPersonalizedRecommendations(userId, limit = 10) {
    // Get content the user has interacted with
    const userInteractions = await UserList.findAll({
      where: { userId },
      include: [
        {
          model: Content,
          include: [{ model: Genre }]
        }
      ]
    });

    // If user is new (cold start), get popular content with high ratings
    if (userInteractions.length === 0) {
      return this.getPopularRecommendations(limit);
    }

    // Combine collaborative and content-based recommendations
    const [collaborativeRecs, contentBasedRecs] = await Promise.all([
      this.getCollaborativeFilteringRecommendations(userId, limit),
      this.getContentBasedRecommendations(userId, limit)
    ]);

    // Merge and deduplicate recommendations
    const allRecommendations = [...collaborativeRecs, ...contentBasedRecs];
    const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);
    
    // Sort by recommendation score and limit results
    return uniqueRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get recommendations based on similar users (collaborative filtering)
   * @param {string} userId - User ID
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Array of recommended content
   */
  async getCollaborativeFilteringRecommendations(userId, limit = 10) {
    // Get users with similar tastes
    const similarUsers = await this.findSimilarUsers(userId);
    
    if (similarUsers.length === 0) {
      return [];
    }

    // Get content rated highly by similar users that the current user hasn't seen
    const userWatchedContent = await UserList.findAll({
      where: { userId },
      attributes: ['contentId']
    });
    
    const watchedContentIds = userWatchedContent.map(item => item.contentId);
    
    // Find content that similar users rated highly
    const recommendations = await UserList.findAll({
      where: {
        userId: {
          [Op.in]: similarUsers.map(user => user.id)
        },
        contentId: {
          [Op.notIn]: watchedContentIds
        },
        rating: {
          [Op.gte]: 4 // Minimum rating threshold
        }
      },
      include: [
        { model: Content, include: [{ model: Genre }] }
      ],
      order: [['rating', 'DESC']],
      limit: limit * 2 // Get more than needed for filtering
    });
    
    // Format and score recommendations
    return recommendations.map(rec => ({
      content: rec.Content,
      score: rec.rating * this.getSimilarityWeight(similarUsers, rec.userId),
      recommendationType: 'collaborative'
    }));
  }

  /**
   * Get content-based recommendations using genre and metadata
   * @param {string} userId - User ID
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Array of recommended content
   */
  async getContentBasedRecommendations(userId, limit = 10) {
    // Get user's favorite genres based on highly rated content
    const userPreferences = await this.getUserGenrePreferences(userId);
    
    if (Object.keys(userPreferences).length === 0) {
      return [];
    }
    
    // Get content the user has already seen
    const userWatchedContent = await UserList.findAll({
      where: { userId },
      attributes: ['contentId']
    });
    
    const watchedContentIds = userWatchedContent.map(item => item.contentId);
    
    // Find content with similar genres that user hasn't seen
    const contentWithGenres = await Content.findAll({
      where: {
        id: {
          [Op.notIn]: watchedContentIds
        }
      },
      include: [{ model: Genre }],
      limit: limit * 3 // Get more for scoring
    });
    
    // Score content based on genre match with user preferences
    const scoredRecommendations = contentWithGenres.map(content => {
      const genreScore = this.calculateGenreMatchScore(content.Genres, userPreferences);
      return {
        content,
        score: genreScore,
        recommendationType: 'content-based'
      };
    });
    
    // Return top scored recommendations
    return scoredRecommendations
      .filter(rec => rec.score > 0.3) // Minimum similarity threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get popular content for new users (cold start)
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Array of popular content
   */
  async getPopularRecommendations(limit = 10) {
    const popularContent = await Content.findAll({
      order: [['rating', 'DESC']],
      limit
    });
    
    return popularContent.map(content => ({
      content,
      score: 1.0,
      recommendationType: 'popular'
    }));
  }

  /**
   * Get "Because You Watched" recommendations
   * @param {string} userId - User ID
   * @param {string} contentId - Content ID
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Array of similar content
   */
  async getBecauseYouWatchedRecommendations(userId, contentId, limit = 5) {
    // Get content details
    const content = await Content.findByPk(contentId, {
      include: [{ model: Genre }]
    });
    
    if (!content) {
      return [];
    }
    
    // Get content the user has already seen
    const userWatchedContent = await UserList.findAll({
      where: { userId },
      attributes: ['contentId']
    });
    
    const watchedContentIds = userWatchedContent.map(item => item.contentId);
    
    // Find similar content based on genres
    const similarContent = await Content.findAll({
      where: {
        id: {
          [Op.notIn]: [...watchedContentIds, contentId]
        },
        type: content.type // Same content type (movie or TV)
      },
      include: [{ model: Genre }],
      limit: limit * 2
    });
    
    // Score content based on similarity
    const scoredRecommendations = similarContent.map(similar => {
      const similarityScore = this.calculateContentSimilarity(content, similar);
      return {
        content: similar,
        score: similarityScore,
        recommendationType: 'similar'
      };
    });
    
    // Return top similar content
    return scoredRecommendations
      .filter(rec => rec.score > 0.5) // Higher threshold for similarity
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find users with similar tastes
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of similar users with similarity scores
   */
  async findSimilarUsers(userId) {
    // Get user's ratings
    const userRatings = await UserList.findAll({
      where: { 
        userId,
        rating: { [Op.not]: null }
      }
    });
    
    if (userRatings.length === 0) {
      return [];
    }
    
    // Get all users who rated some of the same content
    const contentIds = userRatings.map(rating => rating.contentId);
    
    const otherUsersRatings = await UserList.findAll({
      where: {
        userId: { [Op.ne]: userId },
        contentId: { [Op.in]: contentIds },
        rating: { [Op.not]: null }
      },
      include: [{ model: User, attributes: ['id', 'username'] }]
    });
    
    // Group ratings by user
    const userRatingsMap = {};
    userRatings.forEach(rating => {
      userRatingsMap[rating.contentId] = rating.rating;
    });
    
    const otherUsersRatingsMap = {};
    otherUsersRatings.forEach(rating => {
      if (!otherUsersRatingsMap[rating.userId]) {
        otherUsersRatingsMap[rating.userId] = {
          user: rating.User,
          ratings: {}
        };
      }
      otherUsersRatingsMap[rating.userId].ratings[rating.contentId] = rating.rating;
    });
    
    // Calculate similarity between users using Pearson correlation
    const similarities = [];
    for (const otherUserId in otherUsersRatingsMap) {
      const otherUserData = otherUsersRatingsMap[otherUserId];
      const similarity = this.calculatePearsonCorrelation(
        userRatingsMap, 
        otherUserData.ratings
      );
      
      if (similarity > 0.3) { // Minimum similarity threshold
        similarities.push({
          id: otherUserData.user.id,
          username: otherUserData.user.username,
          similarity
        });
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate Pearson correlation between two users' ratings
   * @param {Object} userRatings1 - First user's ratings
   * @param {Object} userRatings2 - Second user's ratings
   * @returns {number} - Correlation coefficient (-1 to 1)
   */
  calculatePearsonCorrelation(userRatings1, userRatings2) {
    // Find common items
    const commonItems = Object.keys(userRatings1).filter(
      id => userRatings2[id] !== undefined
    );
    
    if (commonItems.length === 0) {
      return 0;
    }
    
    // Calculate means
    const mean1 = commonItems.reduce(
      (sum, id) => sum + userRatings1[id], 0
    ) / commonItems.length;
    
    const mean2 = commonItems.reduce(
      (sum, id) => sum + userRatings2[id], 0
    ) / commonItems.length;
    
    // Calculate numerator and denominator
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;
    
    commonItems.forEach(id => {
      const diff1 = userRatings1[id] - mean1;
      const diff2 = userRatings2[id] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    });
    
    if (denominator1 === 0 || denominator2 === 0) {
      return 0;
    }
    
    return numerator / Math.sqrt(denominator1 * denominator2);
  }

  /**
   * Get user's genre preferences based on their ratings
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Map of genre IDs to preference scores
   */
  async getUserGenrePreferences(userId) {
    // Get user's content with ratings
    const userContent = await UserList.findAll({
      where: { 
        userId,
        [Op.or]: [
          { rating: { [Op.not]: null } },
          { status: 'completed' } // Completed items also indicate preference
        ]
      },
      include: [
        {
          model: Content,
          include: [{ model: Genre }]
        }
      ]
    });
    
    // Calculate genre preferences
    const genreScores = {};
    let totalScore = 0;
    
    userContent.forEach(item => {
      const rating = item.rating || 3.5; // Default rating for completed items
      const weight = item.status === 'completed' ? 1 : 0.8; // More weight to completed items
      
      item.Content.Genres.forEach(genre => {
        if (!genreScores[genre.id]) {
          genreScores[genre.id] = 0;
        }
        
        const score = rating * weight;
        genreScores[genre.id] += score;
        totalScore += score;
      });
    });
    
    // Normalize scores
    if (totalScore > 0) {
      Object.keys(genreScores).forEach(genreId => {
        genreScores[genreId] /= totalScore;
      });
    }
    
    return genreScores;
  }

  /**
   * Calculate genre match score between content and user preferences
   * @param {Array} contentGenres - Content's genres
   * @param {Object} userPreferences - User's genre preferences
   * @returns {number} - Similarity score (0-1)
   */
  calculateGenreMatchScore(contentGenres, userPreferences) {
    if (contentGenres.length === 0) {
      return 0;
    }
    
    let matchScore = 0;
    
    contentGenres.forEach(genre => {
      if (userPreferences[genre.id]) {
        matchScore += userPreferences[genre.id];
      }
    });
    
    // Normalize by number of genres
    return matchScore / contentGenres.length;
  }

  /**
   * Calculate content similarity based on genres and metadata
   * @param {Object} content1 - First content
   * @param {Object} content2 - Second content
   * @returns {number} - Similarity score (0-1)
   */
  calculateContentSimilarity(content1, content2) {
    // Calculate genre overlap
    const genres1 = content1.Genres.map(g => g.id);
    const genres2 = content2.Genres.map(g => g.id);
    
    const commonGenres = genres1.filter(id => genres2.includes(id));
    const genreSimilarity = commonGenres.length / 
      Math.max(Math.sqrt(genres1.length * genres2.length), 1);
    
    // Could add more similarity factors (directors, actors, etc.)
    // For now, just use genre similarity
    return genreSimilarity;
  }

  /**
   * Get similarity weight for a user
   * @param {Array} similarUsers - Array of similar users
   * @param {string} userId - User to find weight for
   * @returns {number} - Similarity weight
   */
  getSimilarityWeight(similarUsers, userId) {
    const user = similarUsers.find(u => u.id === userId);
    return user ? user.similarity : 0.5;
  }

  /**
   * Deduplicate recommendations
   * @param {Array} recommendations - Array of recommendations
   * @returns {Array} - Deduplicated recommendations
   */
  deduplicateRecommendations(recommendations) {
    const uniqueMap = {};
    
    recommendations.forEach(rec => {
      const contentId = rec.content.id;
      
      if (!uniqueMap[contentId] || uniqueMap[contentId].score < rec.score) {
        uniqueMap[contentId] = rec;
      }
    });
    
    return Object.values(uniqueMap);
  }
}

module.exports = new RecommendationService();

// controllers/recommendationController.js
const RecommendationService = require('../services/recommendationService');
const { param, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');

// Validation middleware
const getRecommendationsValidation = [
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  validateRequest
];

const getSimilarContentValidation = [
  param('contentId').isUUID(),
  query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
  validateRequest
];

/**
 * Get personalized recommendations for the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 10;
    
    const recommendations = await RecommendationService.getPersonalizedRecommendations(userId, limit);
    
    res.json({
      success: true,
      data: recommendations.map(rec => ({
        ...rec.content.dataValues,
        recommendationType: rec.recommendationType
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get "Because You Watched" recommendations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getSimilarContent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.contentId;
    const limit = req.query.limit || 5;
    
    const recommendations = await RecommendationService.getBecauseYouWatchedRecommendations(
      userId, contentId, limit
    );
    
    res.json({
      success: true,
      data: recommendations.map(rec => ({
        ...rec.content.dataValues,
        similarityScore: rec.score
      }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecommendations: [getRecommendationsValidation, getRecommendations],
  getSimilarContent: [getSimilarContentValidation, getSimilarContent]
};

// routes/recommendationRoutes.js
const express = require('express');
const recommendationController = require('../controllers/recommendationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all recommendation routes with authentication
router.use(authMiddleware);

// Routes
router.get('/', recommendationController.getRecommendations);
router.get('/similar/:contentId', recommendationController.getSimilarContent);

module.exports = router;

// routes/index.js - Add recommendation routes to the main router
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const contentRoutes = require('./contentRoutes');
const listRoutes = require('./listRoutes');
const franchiseRoutes = require('./franchiseRoutes');
const forumRoutes = require('./forumRoutes');
const soundtrackRoutes = require('./soundtrackRoutes');
const recommendationRoutes = require('./recommendationRoutes');

// Register routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/content', contentRoutes);
router.use('/lists', listRoutes);
router.use('/franchises', franchiseRoutes);
router.use('/forum', forumRoutes);
router.use('/soundtracks', soundtrackRoutes);
router.use('/recommendations', recommendationRoutes);

module.exports = router;
