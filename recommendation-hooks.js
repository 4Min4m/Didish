// src/hooks/useRecommendations.js
import { useQuery } from 'react-query';
import api from '../utils/api';

/**
 * Custom hook for fetching various types of recommendations
 */
export const useRecommendations = () => {
  /**
   * Fetch personalized recommendations based on user history
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of recommendations to return
   * @param {Array} options.includeGenres - Array of genre IDs to include
   * @param {boolean} options.enabled - Whether the query is enabled
   * @returns {Object} React Query result object
   */
  const usePersonalRecommendations = (options = {}) => {
    const { limit = 10, includeGenres = [], enabled = true } = options;
    
    return useQuery(
      ['recommendations', 'personal', { limit, includeGenres }],
      () => {
        const params = { limit };
        if (includeGenres.length > 0) {
          params.includeGenres = includeGenres.join(',');
        }
        
        return api.get('/recommendations/personal', { params })
          .then(res => res.data.data);
      },
      {
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        enabled
      }
    );
  };
  
  /**
   * Fetch content-based recommendations
   * @param {Object} options - Query options
   * @returns {Object} React Query result object
   */
  const useContentBasedRecommendations = (options = {}) => {
    const { limit = 10, enabled = true } = options;
    
    return useQuery(
      ['recommendations', 'content-based', { limit }],
      () => api.get('/recommendations/content-based', { params: { limit } })
        .then(res => res.data.data),
      {
        staleTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false,
        enabled
      }
    );
  };
  
  /**
   * Fetch similar content recommendations
   * @param {string} contentId - ID of the content to find similar items for
   * @param {Object} options - Query options
   * @returns {Object} React Query result object
   */
  const useSimilarContentRecommendations = (contentId, options = {}) => {
    const { limit = 10, enabled = true } = options;
    
    return useQuery(
      ['recommendations', 'similar', contentId, { limit }],
      () => api.get(`/recommendations/similar/${contentId}`, { params: { limit } })
        .then(res => res.data.data),
      {
        staleTime: 60 * 60 * 1000, // 1 hour
        refetchOnWindowFocus: false,
        enabled: enabled && Boolean(contentId)
      }
    );
  };
  
  /**
   * Fetch popular content recommendations
   * @param {Object} options - Query options
   * @returns {Object} React Query result object
   */
  const usePopularRecommendations = (options = {}) => {
    const { limit = 10, timeframe = 'month', enabled = true } = options;
    
    return useQuery(
      ['recommendations', 'popular', { limit, timeframe }],
      () => api.get('/recommendations/popular', { params: { limit, timeframe } })
        .then(res => res.data.data),
      {
        staleTime: 15 * 60 * 1000, // 15 minutes
        refetchOnWindowFocus: false,
        enabled
      }
    );
  };
  
  /**
   * Fetch discovery recommendations
   * @param {Object} options - Query options
   * @returns {Object} React Query result object
   */
  const useDiscoveryRecommendations = (options = {}) => {
    const { limit = 10, enabled = true } = options;
    
    return useQuery(
      ['recommendations', 'discovery', { limit }],
      () => api.get('/recommendations/discovery', { params: { limit } })
        .then(res => res.data.data),
      {
        staleTime: 60 * 60 * 1000, // 1 hour
        refetchOnWindowFocus: false,
        enabled
      }
    );
  };
  
  return {
    usePersonalRecommendations,
    useContentBasedRecommendations,
    useSimilarContentRecommendations,
    usePopularRecommendations,
    useDiscoveryRecommendations
  };
};

export default useRecommendations;
