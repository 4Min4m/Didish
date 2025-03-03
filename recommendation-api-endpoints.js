// src/routes/recommendationRoutes.js
const express = require('express');
const router = express.Router();
const recommendationService = require('../services/recommendationService');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { check } = require('express-validator');

/**
 * @route GET /api/recommendations/personal
 * @desc Get personalized recommendations for the current user
 * @access Private
 */
router.get('/personal', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, excludeGenres, includeGenres } = req.query;
    
    // Parse genre filters
    const options = { 
      limit: parseInt(limit),
      excludeIds: []
    };
    
    if (includeGenres) {
      options.genres = includeGenres.split(',');
    }
    
    // Get personalized recommendations
    const recommendations = await recommendationService.getCollaborativeRecommendations(
      userId,
      options
    );
    
    return res.json({ 
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error fetching personalized recommendations:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recommendations' 
    });
  }
});

/**
 * @route GET /api/recommendations/content-based
 * @desc Get content-based recommendations for the current user
 * @access Private
 */
router.get('/content-based', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    
    const options = { limit: parseInt(limit) };
    const recommendations = await recommendationService.getContentBasedRecommendations(
      userId,
      options
    );
    
    return res.json({ 
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error fetching content-based recommendations:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recommendations' 
    });
  }
});

/**
 * @route GET /api/recommendations/similar/:contentId
 * @desc Get recommendations similar to a specific content item
 * @access Public
 */
router.get('/similar/:contentId', 
  [
    check('contentId').isString().trim().notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { contentId } = req.params;
      const { limit = 10 } = req.query;
      const userId = req.user?.id || null; // Optional auth
      
      const options = { 
        limit: parseInt(limit),
        userId
      };
      
      const recommendations = await recommendationService.getSimilarContentRecommendations(
        contentId,
        options
      );
      
      return res.json({ 
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Error fetching similar content recommendations:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch recommendations' 
      });
    }
  }
);

/**
 * @route GET /api/recommendations/popular
 * @desc Get popular content recommendations
 * @access Public
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10, timeframe = 'month' } = req.query;
    
    // Validate timeframe
    const validTimeframes = ['week', 'month', 'year', 'all'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeframe parameter'
      });
    }
    
    const options = { 
      limit: parseInt(limit),
      timeframe
    };
    
    const recommendations = await recommendationService.getPopularRecommendations(options);
    
    return res.json({ 
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error fetching popular recommendations:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recommendations' 
    });
  }
});

/**
 * @route GET /api/recommendations/discovery
 * @desc Get discovery recommendations outside user's usual preferences
 * @access Private
 */
router.get('/discovery', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    
    const options = { limit: parseInt(limit) };
    const recommendations = await recommendationService.getDiscoveryRecommendations(
      userId,
      options
    );
    
    return res.json({ 
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error fetching discovery recommendations:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recommendations' 
    });
  }
});

module.exports = router;
