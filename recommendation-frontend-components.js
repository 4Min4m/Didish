// src/components/recommendations/RecommendationCarousel.js
import React from 'react';
import styled from 'styled-components';
import { useQuery } from 'react-query';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import ContentCard from '../content/ContentCard';
import api from '../../utils/api';
import Loader from '../common/Loader';
import Error from '../common/Error';

const Container = styled.div`
  margin-bottom: 40px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin: 0;
`;

const Controls = styled.div`
  display: flex;
  gap: 10px;
`;

const ControlButton = styled.button`
  background: ${props => props.theme.cardBg};
  color: ${props => props.theme.textPrimary};
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: ${props => props.theme.primary};
    color: white;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      background: ${props => props.theme.cardBg};
      color: ${props => props.theme.textPrimary};
    }
  }
`;

const CarouselWrapper = styled.div`
  position: relative;
  overflow: hidden;
`;

const CardContainer = styled.div`
  display: flex;
  transition: transform 0.5s ease;
  transform: translateX(-${props => props.offset}px);
`;

const CardWrapper = styled.div`
  flex: 0 0 auto;
  width: 240px;
  padding: 0 10px;
`;

const RecommendationBadge = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: ${props => 
    props.type === 'collaborative' ? '#1e88e5' : 
    props.type === 'content-based' ? '#43a047' : 
    props.type === 'similar' ? '#e53935' : '#f57c00'
  };
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  z-index: 2;
`;

const EmptyState = styled.div`
  background: ${props => props.theme.cardBg};
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  color: ${props => props.theme.textSecondary};
`;

/**
 * Carousel component for displaying recommended content
 * @param {Object} props
 * @param {string} props.title - Carousel title
 * @param {string} props.url - API endpoint for fetching recommendations
 * @param {Object} props.params - Additional query parameters
 * @param {boolean} props.showBadges - Whether to show recommendation type badges
 */
const RecommendationCarousel = ({ 
  title, 
  url, 
  params = {}, 
  showBadges = true 
}) => {
  const [offset, setOffset] = React.useState(0);
  const [visibleItems, setVisibleItems] = React.useState(4);
  const containerRef = React.useRef(null);
  
  // Fetch recommendations
  const { data, isLoading, error } = useQuery(
    ['recommendations', url, params],
    () => api.get(url, { params }).then(res => res.data.data),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false
    }
  );
  
  // Recalculate visible items on window resize
  React.useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const itemWidth = 260; // card width + padding
        setVisibleItems(Math.floor(containerWidth / itemWidth));
        setOffset(0); // Reset position on resize
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle carousel navigation
  const handlePrev = () => {
    setOffset(prevOffset => Math.max(0, prevOffset - 260));
  };
  
  const handleNext = () => {
    if (!data) return;
    const maxOffset = (data.length - visibleItems) * 260;
    setOffset(prevOffset => Math.min(maxOffset, prevOffset + 260));
  };
  
  if (isLoading) return <Loader />;
  if (error) return <Error message="Failed to load recommendations" />;
  if (!data || data.length === 0) {
    return (
      <Container>
        <Header>
          <Title>{title}</Title>
        </Header>
        <EmptyState>
          <p>No recommendations available yet. Continue exploring content to get personalized suggestions!</p>
        </EmptyState>
      </Container>
    );
  }
  
  return (
    <Container>
      <Header>
        <Title>{title}</Title>
        <Controls>
          <ControlButton 
            onClick={handlePrev} 
            disabled={offset <= 0}
          >
            <FaChevronLeft />
          </ControlButton>
          <ControlButton 
            onClick={handleNext} 
            disabled={offset >= (data.length - visibleItems) * 260}
          >
            <FaChevronRight />
          </ControlButton>
        </Controls>
      </Header>
      
      <CarouselWrapper ref={containerRef}>
        <CardContainer offset={offset}>
          {data.map(content => (
            <CardWrapper key={content.id}>
              {showBadges && content.recommendationType && (
                <RecommendationBadge type={content.recommendationType}>
                  {content.recommendationType === 'collaborative' && 'For You'}
                  {content.recommendationType === 'content-based' && 'Similar Genres'}
                  {content.recommendationType === 'similar' && 'Similar Content'}
                  {content.recommendationType === 'popular' && 'Trending'}
                </RecommendationBadge>
              )}
              <ContentCard content={content} />
            </CardWrapper>
          ))}
        </CardContainer>
      </CarouselWrapper>
    </Container>
  );
};

export default RecommendationCarousel;

// src/components/recommendations/BecauseYouWatchedSection.js
import React from 'react';
import styled from 'styled-components';
import { useQuery } from 'react-query';
import api from '../../utils/api';
import RecommendationCarousel from './RecommendationCarousel';
import Loader from '../common/Loader';

const Container = styled.div`
  margin: 40px 0;
`;

/**
 * Section that shows recommendations based on a specific content
 * @param {Object} props
 * @param {string} props.contentId - ID of the source content
 * @param {string} props.contentTitle - Title of the source content
 */
const BecauseYouWatchedSection = ({ contentId, contentTitle }) => {
  // Check if content has recommendations
  const { data, isLoading } = useQuery(
    ['similar-check', contentId],
    () => api.get(`/recommendations/similar/${contentId}`, { params: { limit: 1 } })
      .then(res => res.data.data),
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false
    }
  );
  
  if (isLoading) return <Loader />;
  if (!data || data.length === 0) return null;
  
  return (
    <Container>
      <RecommendationCarousel 
        title={`Because You Watched: ${contentTitle}`}
        url={`/recommendations/similar/${contentId}`}
        params={{ limit: 10 }}
        showBadges={false}
      />
    </Container>
  );
};

export default BecauseYouWatchedSection;

// src/pages/Home.js - Updated with recommendation sections
import React from 'react';
import styled from 'styled-components';
import { useQuery } from 'react-query';
import api from '../utils/api';
import ContentGrid from '../components/content/ContentGrid';
import Loader from '../components/common/Loader';
import Error from '../components/common/Error';
import RecommendationCarousel from '../components/recommendations/RecommendationCarousel';
import { useAuth } from '../contexts/AuthContext';

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

const Home = () => {
  const { currentUser } = useAuth();
  
  // Fetch trending content
  const { data: trendingContent, isLoading: trendingLoading, error: trendingError } = useQuery(
    'trending-content',
    () => api.get('/content/popular', { params: { limit: 12 } }).then(res => res.data.data),
    {
      staleTime: 30 * 60 * 1000, // 30 minutes
    }
  );
  
  // Fetch recently added content
  const { data: newContent, isLoading