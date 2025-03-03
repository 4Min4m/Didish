// src/pages/ContentDetail.js
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ContentHeader from '../components/content/ContentHeader';
import ContentDetails from '../components/content/ContentDetails';
import ContentActions from '../components/content/ContentActions';
import ReviewSection from '../components/reviews/ReviewSection';
import Loader from '../components/common/Loader';
import Error from '../components/common/Error';
import BecauseYouWatchedSection from '../components/recommendations/BecauseYouWatchedSection';
import useRecommendations from '../hooks/useRecommendations';
import RecommendationCarousel from '../components/recommendations/RecommendationCarousel';

const Container = styled.div`
  padding: 20px;
`;

const Content = styled.div`
  display: grid;
  grid-template-columns: 70% 30%;
  gap: 30px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const MainColumn = styled.div``;

const SideColumn = styled.div``;

const Section = styled.div`
  margin-bottom: 30px;
`;

const ContentDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { useSimilarContentRecommendations } = useRecommendations();
  
  // Fetch content details
  const { 
    data: content, 
    isLoading, 
    error,
    refetch: refetchContent
  } = useQuery(
    ['content', id],
    () => api.get(`/content/${id}`).then(res => res.data.data),
    {
      enabled: Boolean(id),
      staleTime: 10 * 60 * 1000 // 10 minutes
    }
  );
  
  // Fetch similar content recommendations
  const { 
    data: similarContent,
    isLoading: similarLoading
  } = useSimilarContentRecommendations(id, {
    limit: 10,
    enabled: Boolean(id)
  });
  
  // Scroll to top on content change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  
  if (isLoading) return <Loader />;
  if (error) return <Error message="Failed to load content details" />;
  if (!content) return <Error message="Content not found" />;
  
  return (
    <Container>
      <ContentHeader 
        title={content.title}
        backdropUrl={content.backdropUrl}
        posterUrl={content.posterUrl}
        year={content.releaseYear}
        rating={content.rating}
        type={content.type}
      />
      
      <Content>
        <MainColumn>
          <ContentDetails 
            overview={content.overview}
            genres={content.genres}
            directors={content.directors}
            cast={content.cast}
            runtime={content.runtime}
            releaseDate={content.releaseDate}
          />
          
          <Section>
            <ContentActions 
              contentId={content.id}
              onStatusChange={refetchContent}
            />
          </Section>
          
          <ReviewSection contentId={content.id} />
        </MainColumn>
        
        <SideColumn>
          {/* Additional content information and stats */}
          {/* ... */}
        </SideColumn>
      </Content>
      
      {/* "Because You Watched" section for logged in users */}
      {isAuthenticated && (
        <BecauseYouWatchedSection
          contentId={content.id}
          contentTitle={content.title}
        />
      )}
      
      {/* Similar content for all users */}
      {!similarLoading && similarContent && similarContent.length > 0 && (
        <RecommendationCarousel
          title="Similar Content"
          url={`/recommendations/similar/${content.id}`}
          params={{ limit: 10 }}
          showBadges={false}
        />
      )}
    </Container>
  );
};

export default ContentDetail;
