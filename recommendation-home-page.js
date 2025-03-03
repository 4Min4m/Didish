// src/pages/Home.js
import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import useRecommendations from '../hooks/useRecommendations';
import RecommendationCarousel from '../components/recommendations/RecommendationCarousel';
import ContentGrid from '../components/content/ContentGrid';
import Loader from '../components/common/Loader';
import Error from '../components/common/Error';
import { useQuery } from 'react-query';
import api from '../utils/api';

const Container = styled.div`
  padding: 20px;
`;

const Section = styled.div`
  margin-bottom: 40px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
`;

const WelcomeMessage = styled.div`
  margin-bottom: 30px;
  
  h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  
  p {
    color: ${props => props.theme.textSecondary};
    font-size: 16px;
  }
`;

const Home = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const {
    usePersonalRecommendations,
    useContentBasedRecommendations,
    usePopularRecommendations,
    useDiscoveryRecommendations
  } = useRecommendations();
  
  // Get user's recently watched content if authenticated
  const { data: recentlyWatched, isLoading: recentLoading } = useQuery(
    'recently-watched',
    () => api.get('/user/content/recently-watched', { params: { limit: 5 } })
      .then(res => res.data.data),
    {
      enabled: isAuthenticated,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  );
  
  // Fetch recommendations
  const { data: personalRecs, isLoading: personalLoading } = usePersonalRecommendations({
    limit: 10,
    enabled: isAuthenticated
  });
  
  const { data: contentBasedRecs, isLoading: contentBasedLoading } = useContentBasedRecommendations({
    limit: 10,
    enabled: isAuthenticated
  });
  
  const { data: popularRecs, isLoading: popularLoading } = usePopularRecommendations({
    limit: 12,
    timeframe: 'month'
  });
  
  const { data: discoveryRecs, isLoading: discoveryLoading } = useDiscoveryRecommendations({
    limit: 10,
    enabled: isAuthenticated
  });
  
  // Fetch recently added content
  const { data: newContent, isLoading: newContentLoading } = useQuery(
    'new-content',
    () => api.get('/content/recent', { params: { limit: 12 } })
      .then(res => res.data.data),
    {
      staleTime: 30 * 60 * 1000 // 30 minutes
    }
  );
  
  // Handle initial page load scroll position
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Generate the appropriate welcome message
  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    
    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 18) {
      greeting = 'Good afternoon';
    }
    
    if (isAuthenticated && currentUser) {
      return `${greeting}, ${currentUser.displayName || 'there'}!`;
    }
    
    return greeting;
  };
  
  return (
    <Container>
      <WelcomeMessage>
        <h1>{getWelcomeMessage()}</h1>
        {isAuthenticated ? (
          <p>Here's what we've picked for you today.</p>
        ) : (
          <p>Sign in to get personalized recommendations based on your activity.</p>
        )}
      </WelcomeMessage>
      
      {/* For authenticated users */}
      {isAuthenticated && (
        <>
          {/* Personal recommendations based on collaborative filtering */}
          {personalLoading ? (
            <Loader />
          ) : personalRecs && personalRecs.length > 0 ? (
            <RecommendationCarousel
              title="Recommended For You"
              url="/recommendations/personal"
              params={{ limit: 10 }}
              showBadges={true}
            />
          ) : null}
          
          {/* Recently watched section */}
          {recentLoading ? (
            <Loader />
          ) : recentlyWatched && recentlyWatched.length > 0 ? (
            <Section>
              <SectionTitle>Continue Watching</SectionTitle>
              <ContentGrid 
                content={recentlyWatched} 
                cols={5}
                showProgress={true}
              />
            </Section>
          ) : null}
          
          {/* Content-based recommendations */}
          {contentBasedLoading ? (
            <Loader />
          ) : contentBasedRecs && contentBasedRecs.length > 0 ? (
            <RecommendationCarousel
              title="More Like What You Enjoy"
              url="/recommendations/content-based"
              params={{ limit: 10 }}
              showBadges={true}
            />
          ) : null}
          
          {/* Discovery section */}
          {discoveryLoading ? (
            <Loader />
          ) : discoveryRecs && discoveryRecs.length > 0 ? (
            <RecommendationCarousel
              title="Discover Something New"
              url="/recommendations/discovery"
              params={{ limit: 10 }}
              showBadges={true}
            />
          ) : null}
        </>
      )}
      
      {/* Popular content - shown to all users */}
      {popularLoading ? (
        <Loader />
      ) : (
        <RecommendationCarousel
          title="Popular Right Now"
          url="/recommendations/popular"
          params={{ limit: 12, timeframe: 'month' }}
          showBadges={true}
        />
      )}
      
      {/* Recently added content - shown to all users */}
      {newContentLoading ? (
        <Loader />
      ) : newContent && newContent.length > 0 ? (
        <Section>
          <SectionTitle>Recently Added</SectionTitle>
          <ContentGrid content={newContent} cols={6} />
        </Section>
      ) : (
        <Error message="Failed to load new content" />
      )}
    </Container>
  );
};

export default Home;
