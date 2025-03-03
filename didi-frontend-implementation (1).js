// src/components/soundtrack/SoundtrackList.js (continued)
const TrackTimestamp = styled.div`
  font-size: 12px;
  color: ${props => props.theme.textSecondary};
  margin-top: 4px;
`;

const TrackActions = styled.div`
  display: flex;
  gap: 10px;
`;

const ActionIcon = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.theme.textSecondary};
  cursor: pointer;
  font-size: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${props => props.spotify ? '#1DB954' : props.theme.primary};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 30px;
  color: ${props => props.theme.textSecondary};
`;

const SoundtrackList = ({ contentId }) => {
  const { data: soundtrack, isLoading, error } = useQuery(['soundtrack', contentId], () => 
    api.get(`/content/${contentId}/soundtrack`).then(res => res.data)
  );
  
  if (isLoading) return <Loader />;
  if (error) return <Error message="Failed to load soundtrack" />;
  
  return (
    <Container>
      <Header>
        <Title>Soundtrack</Title>
        <SpotifyConnect>
          <FaSpotify /> Connect with Spotify
        </SpotifyConnect>
      </Header>
      
      {soundtrack.length === 0 ? (
        <EmptyState>
          <p>No soundtrack information available for this content.</p>
        </EmptyState>
      ) : (
        <TrackList>
          {soundtrack.map(track => (
            <Track key={track.id}>
              <TrackImage src={track.album_image} alt={track.title} />
              <TrackInfo>
                <TrackName>{track.title}</TrackName>
                <ArtistName>{track.artist}</ArtistName>
                <TrackTimestamp>Plays at {track.timestamp_formatted}</TrackTimestamp>
              </TrackInfo>
              <TrackActions>
                <ActionIcon spotify>
                  <FaSpotify />
                </ActionIcon>
                <ActionIcon>
                  <FaPlay />
                </ActionIcon>
                <ActionIcon>
                  <FaPlus />
                </ActionIcon>
              </TrackActions>
            </Track>
          ))}
        </TrackList>
      )}
    </Container>
  );
};

export default SoundtrackList;

// src/pages/Home.js
import React from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import api from '../utils/api';
import Loader from '../components/common/Loader';
import Error from '../components/common/Error';
import ContentCard from '../components/content/ContentCard';
import FranchiseSlider from '../components/franchise/FranchiseSlider';
import HeroSection from '../components/home/HeroSection';
import RecommendationSection from '../components/home/RecommendationSection';
import { useAuth } from '../contexts/AuthContext';

const Container = styled.div`
  padding: 0 0 40px 0;
`;

const Section = styled.section`
  margin-bottom: 40px;
  padding: 0 20px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 600;
  margin: 0;
`;

const ViewAll = styled.a`
  color: ${props => props.theme.primary};
  font-size: 14px;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
`;

const Home = () => {
  const { currentUser } = useAuth();
  
  const { data: trendingMovies, isLoading: loadingMovies, error: moviesError } = useQuery(
    'trendingMovies', 
    () => api.get('/content/trending?type=movie&limit=6').then(res => res.data)
  );
  
  const { data: trendingShows, isLoading: loadingShows, error: showsError } = useQuery(
    'trendingShows', 
    () => api.get('/content/trending?type=tv&limit=6').then(res => res.data)
  );
  
  const { data: franchises, isLoading: loadingFranchises, error: franchisesError } = useQuery(
    'popularFranchises', 
    () => api.get('/franchises/popular?limit=5').then(res => res.data)
  );
  
  return (
    <Container>
      <HeroSection />
      
      {currentUser && (
        <RecommendationSection userId={currentUser.id} />
      )}
      
      <Section>
        <SectionHeader>
          <SectionTitle>Popular Franchises</SectionTitle>
          <ViewAll href="/franchises">View All</ViewAll>
        </SectionHeader>
        
        {loadingFranchises ? (
          <Loader />
        ) : franchisesError ? (
          <Error message="Failed to load franchises" />
        ) : (
          <FranchiseSlider franchises={franchises} />
        )}
      </Section>
      
      <Section>
        <SectionHeader>
          <SectionTitle>Trending Movies</SectionTitle>
          <ViewAll href="/movies">View All</ViewAll>
        </SectionHeader>
        
        {loadingMovies ? (
          <Loader />
        ) : moviesError ? (
          <Error message="Failed to load trending movies" />
        ) : (
          <ContentGrid>
            {trendingMovies.map(movie => (
              <ContentCard key={movie.id} content={movie} />
            ))}
          </ContentGrid>
        )}
      </Section>
      
      <Section>
        <SectionHeader>
          <SectionTitle>Trending TV Shows</SectionTitle>
          <ViewAll href="/shows">View All</ViewAll>
        </SectionHeader>
        
        {loadingShows ? (
          <Loader />
        ) : showsError ? (
          <Error message="Failed to load trending shows" />
        ) : (
          <ContentGrid>
            {trendingShows.map(show => (
              <ContentCard key={show.id} content={show} />
            ))}
          </ContentGrid>
        )}
      </Section>
    </Container>
  );
};

export default Home;

// src/components/home/HeroSection.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { FaPlay, FaInfoCircle } from 'react-icons/fa';
import api from '../../utils/api';

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const Container = styled.div`
  position: relative;
  height: 600px;
  margin-bottom: 40px;
`;

const SlideContainer = styled.div`
  position: relative;
  height: 100%;
  overflow: hidden;
`;

const Slide = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${props => (props.active ? '1' : '0')};
  transition: opacity 1s ease;
  animation: ${props => (props.active ? fadeIn : 'none')} 1s ease;
`;

const BackdropImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8));
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 40px;
`;

const Content = styled.div`
  max-width: 600px;
  color: white;
`;

const Title = styled.h1`
  font-size: 48px;
  font-weight: 700;
  margin: 0 0 15px 0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
`;

const Overview = styled.p`
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 20px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
`;

const Button = styled(Link)`
  background: ${props => props.primary ? props.theme.primary : 'rgba(255,255,255,0.1)'};
  color: white;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.primary ? props.theme.primaryHover : 'rgba(255,255,255,0.2)'};
  }
`;

const Indicators = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
`;

const Indicator = styled.button`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.active ? props.theme.primary : 'rgba(255,255,255,0.3)'};
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.active ? props.theme.primary : 'rgba(255,255,255,0.5)'};
  }
`;

const HeroSection = () => {
  const [slides, setSlides] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchFeaturedContent = async () => {
      try {
        const response = await api.get('/content/featured');
        setSlides(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch featured content:', error);
        setLoading(false);
      }
    };
    
    fetchFeaturedContent();
  }, []);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex(prevIndex => (prevIndex + 1) % slides.length);
    }, 6000);
    
    return () => clearInterval(timer);
  }, [slides.length]);
  
  if (loading || slides.length === 0) {
    return <div>Loading...</div>;
  }
  
  return (
    <Container>
      <SlideContainer>
        {slides.map((slide, index) => (
          <Slide key={slide.id} active={index === activeIndex}>
            <BackdropImage 
              src={`https://image.tmdb.org/t/p/original${slide.backdrop_path}`} 
              alt={slide.title} 
            />
            <Overlay>
              <Content>
                <Title>{slide.title}</Title>
                <Overview>{slide.overview}</Overview>
                <ButtonContainer>
                  <Button primary to={`/content/${slide.id}`}>
                    <FaPlay /> Watch Trailer
                  </Button>
                  <Button to={`/content/${slide.id}`}>
                    <FaInfoCircle /> More Info
                  </Button>
                </ButtonContainer>
              </Content>
            </Overlay>
          </Slide>
        ))}
      </SlideContainer>
      
      <Indicators>
        {slides.map((_, index) => (
          <Indicator 
            key={index}
            active={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </Indicators>
    </Container>
  );
};

export default HeroSection;

// src/components/layout/Navbar.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FaSearch, FaBell, FaUser, FaSignOutAlt, FaFilm, FaTv, FaMusic, FaComments } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.png';

const NavContainer = styled.nav`
  background: ${props => props.scrolled ? props.theme.navBgScrolled : props.theme.navBg};
  padding: 15px 30px;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s ease;
  box-shadow: ${props => props.scrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'};
`;

const NavContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
`;

const LogoContainer = styled(Link)`
  display: flex;
  align-items: center;
  text-decoration: none;
`;

const LogoImage = styled.img`
  height: 40px;
  margin-right: 10px;
`;

const LogoText = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.primary};
  margin: 0;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
`;

const NavLink = styled(Link)`
  color: ${props => props.theme.textPrimary};
  text-decoration: none;
  margin: 0 15px;
  font-size: 16px;
  font-weight: 500;
  transition: color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    color: ${props => props.theme.primary};
  }
`;

const SearchContainer = styled.div`
  position: relative;
  margin: 0 20px;
`;

const SearchInput = styled.input`
  background: ${props => props.theme.inputBg};
  border: 1px solid ${props => props.theme.borderColor};
  border-radius: 20px;
  padding: 8px 15px 8px 35px;
  color: ${props => props.theme.textPrimary};
  font-size: 14px;
  width: 200px;
  transition: all 0.3s ease;
  
  &:focus {
    width: 300px;
    outline: none;
    border-color: ${props => props.theme.primary};
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.textSecondary};
  font-size: 14px;
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
`;

const NotificationButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.theme.textPrimary};
  font-size: 18px;
  margin-right: 20px;
  cursor: pointer;
  position: relative;
  
  &:hover {
    color: ${props => props.theme.primary};
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  background: ${props => props.theme.primary};
  color: white;
  font-size: 10px;
  font-weight: bold;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ProfileButton = styled.button`
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: ${props => props.theme.textPrimary};
  
  &:hover {
    color: ${props => props.theme.primary};
  }
`;

const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
`;

const Username = styled.span`
  font-size: 14px;
  font-weight: 500;
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 70px;
  right: 30px;
  background: ${props => props.theme.dropdownBg};
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  width: 200px;
  z-index: 10;
  overflow: hidden;
  opacity: ${props => props.show ? '1' : '0'};
  transform: ${props => props.show ? 'translateY(0)' : 'translateY(-10px)'};
  pointer-events: ${props => props.show ? 'auto' : 'none'};
  transition: all 0.2s ease;
`;

const DropdownItem = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  color: ${props => props.theme.textPrimary};
  text-decoration: none;
  font-size: 14px;
  
  &:hover {
    background: ${props => props.theme.dropdownHoverBg};
  }
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: ${props => props.theme.textPrimary};
  font-size: 14px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.theme.dropdownHoverBg};
  }
`;

const AuthButtons = styled.div`
  display: flex;
  gap: 15px;
`;

const AuthButton = styled(Link)`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  
  background: ${props => props.primary ? props.theme.primary : 'transparent'};
  color: ${props => props.primary ? props.theme.buttonText : props.theme.textPrimary};
  border: ${props => props.primary ? 'none' : `1px solid ${props.theme.borderColor}`};
  
  &:hover {
    background: ${props => props.primary ? props.theme.primaryHover : props.theme.buttonHoverBg};
  }
`;

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${searchQuery}`);
      setSearchQuery('');
    }
  };
  
  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    navigate('/');
  };
  
  return (
    <NavContainer scrolled={scrolled}>
      <NavContent>
        <LogoContainer to="/">
          <LogoImage src={logo} alt="Didi Logo" />
          <LogoText>Didi</LogoText>
        </LogoContainer>
        
        <NavLinks>
          <NavLink to="/movies">
            <FaFilm /> Movies
          </NavLink>
          <NavLink to="/shows">
            <FaTv /> TV Shows
          </NavLink>
          <NavLink to="/soundtracks">
            <FaMusic /> Soundtracks
          </NavLink>
          <NavLink to="/forum">
            <FaComments /> Forum
          </NavLink>
        </NavLinks>
        
        <UserSection>
          <form onSubmit={handleSearchSubmit}>
            <SearchContainer>
              <SearchIcon>
                <FaSearch />
              </SearchIcon>
              <SearchInput 
                type="text" 
                placeholder="Search movies, shows..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchContainer>
          </form>
          
          {currentUser ? (
            <>
              <NotificationButton>
                <FaBell />
                <NotificationBadge>3</NotificationBadge>
              </NotificationButton>
              
              <ProfileButton onClick={() => setShowDropdown(!showDropdown)}>
                <Avatar 
                  src={currentUser.avatar || 'https://via.placeholder.com/100'} 
                  alt={currentUser.username} 
                />
                <Username>{currentUser.username}</Username>
              </ProfileButton>
              
              <DropdownMenu show={showDropdown}>
                <DropdownItem to={`/profile/${currentUser.id}`}>
                  <FaUser /> Profile
                </DropdownItem>
                <LogoutButton onClick={handleLogout}>
                  <FaSignOutAlt /> Log Out
                </LogoutButton>
              </DropdownMenu>
            </>
          ) : (
            <AuthButtons>
              <AuthButton to="/login">Log In</AuthButton>
              <AuthButton to="/register" primary>Register</AuthButton>
            </AuthButtons>
          )}
        </UserSection>
      </NavContent>
    </NavContainer>
  );
};

export default Navbar;
