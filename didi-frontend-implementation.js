// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { Provider } from 'react-redux';
import { QueryClientProvider, QueryClient } from 'react-query';
import store from './store';
import { darkTheme } from './styles/theme';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/common/PrivateRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ContentDetail from './pages/ContentDetail';
import Search from './pages/Search';
import Franchise from './pages/Franchise';
import Forum from './pages/Forum';
import NotFound from './pages/NotFound';

// Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Notifications from './components/common/Notifications';

const queryClient = new QueryClient();

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider theme={darkTheme}>
            <Router>
              <div className="app-container">
                <Navbar />
                <Notifications />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/content/:id" element={<ContentDetail />} />
                    <Route path="/franchise/:id" element={<Franchise />} />
                    <Route path="/forum" element={<Forum />} />
                    <Route path="/profile/:id" element={<PrivateRoute><Profile /></PrivateRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </Router>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;

// src/contexts/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setCurrentUser(response.data);
    } catch (err) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setError(err.response?.data?.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentUser(user);
      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentUser(user);
      return user;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// src/components/content/ContentCard.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { FaStar, FaBookmark, FaCheck, FaClock } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { addToList } from '../../store/slices/userListSlice';
import { useAuth } from '../../contexts/AuthContext';

const Card = styled.div`
  background: ${props => props.theme.cardBg};
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  position: relative;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  }
`;

const ImageContainer = styled.div`
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 50%;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
    pointer-events: none;
  }
`;

const Image = styled.img`
  width: 100%;
  height: 280px;
  object-fit: cover;
  transition: transform 0.5s ease;
  
  ${Card}:hover & {
    transform: scale(1.05);
  }
`;

const ContentInfo = styled.div`
  padding: 15px;
`;

const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.textPrimary};
`;

const Details = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
  color: ${props => props.theme.textSecondary};
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  
  svg {
    color: #FFD700;
    margin-right: 4px;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

const ActionButton = styled.button`
  background: ${props => props.active ? props.theme.primary : 'transparent'};
  border: 1px solid ${props => props.theme.primary};
  color: ${props => props.active ? props.theme.buttonText : props.theme.primary};
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.primaryHover};
    color: ${props => props.theme.buttonText};
  }
`;

const ContentType = styled.span`
  position: absolute;
  top: 10px;
  left: 10px;
  background: ${props => props.type === 'movie' ? '#e53935' : '#1e88e5'};
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  z-index: 1;
`;

const ContentCard = ({ content }) => {
  const { currentUser } = useAuth();
  const dispatch = useDispatch();
  
  const { id, title, type, poster_path, release_date, rating } = content;
  const year = new Date(release_date).getFullYear();
  
  const handleAddToList = (status) => {
    if (!currentUser) return;
    dispatch(addToList({ contentId: id, status }));
  };
  
  return (
    <Card>
      <ContentType type={type}>{type === 'movie' ? 'Movie' : 'TV'}</ContentType>
      <Link to={`/content/${id}`}>
        <ImageContainer>
          <Image src={`https://image.tmdb.org/t/p/w500${poster_path}`} alt={title} />
        </ImageContainer>
      </Link>
      <ContentInfo>
        <Link to={`/content/${id}`}>
          <Title>{title}</Title>
        </Link>
        <Details>
          <span>{year}</span>
          <Rating>
            <FaStar />
            <span>{rating.toFixed(1)}</span>
          </Rating>
        </Details>
        {currentUser && (
          <ActionButtons>
            <ActionButton onClick={() => handleAddToList('watching')}>
              <FaBookmark /> Watching
            </ActionButton>
            <ActionButton onClick={() => handleAddToList('completed')}>
              <FaCheck /> Completed
            </ActionButton>
            <ActionButton onClick={() => handleAddToList('plan_to_watch')}>
              <FaClock /> Plan to Watch
            </ActionButton>
          </ActionButtons>
        )}
      </ContentInfo>
    </Card>
  );
};

export default ContentCard;

// src/pages/ContentDetail.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { FaStar, FaBookmark, FaCheck, FaClock, FaPlay, FaSpotify } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ContentComments from '../components/content/ContentComments';
import SoundtrackList from '../components/soundtrack/SoundtrackList';
import Loader from '../components/common/Loader';
import Error from '../components/common/Error';
import TrailerModal from '../components/content/TrailerModal';
import RelatedContent from '../components/content/RelatedContent';

const Container = styled.div`
  padding: 20px;
`;

const Backdrop = styled.div`
  position: relative;
  height: 400px;
  margin-bottom: 30px;
  border-radius: 12px;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8));
    z-index: 1;
  }
`;

const BackdropImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ContentInfo = styled.div`
  position: relative;
  margin-top: -100px;
  z-index: 2;
  display: flex;
  padding: 0 40px;
`;

const Poster = styled.img`
  width: 200px;
  height: 300px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
`;

const Details = styled.div`
  margin-left: 30px;
  color: white;
`;

const Title = styled.h1`
  margin: 0 0 10px 0;
  font-size: 32px;
  font-weight: 700;
`;

const Meta = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  font-size: 14px;
  color: rgba(255,255,255,0.8);
`;

const Rating = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  
  svg {
    color: #FFD700;
  }
`;

const Overview = styled.p`
  margin-bottom: 20px;
  line-height: 1.6;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
`;

const Button = styled.button`
  background: ${props => props.primary ? props.theme.primary : 'rgba(255,255,255,0.1)'};
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.primary ? props.theme.primaryHover : 'rgba(255,255,255,0.2)'};
  }
`;

const ContentTabs = styled.div`
  margin-top: 40px;
`;

const TabButtons = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.borderColor};
  margin-bottom: 20px;
`;

const TabButton = styled.button`
  background: transparent;
  border: none;
  color: ${props => props.active ? props.theme.primary : props.theme.textSecondary};
  font-size: 16px;
  font-weight: ${props => props.active ? '600' : '400'};
  padding: 12px 20px;
  cursor: pointer;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: ${props => props.active ? props.theme.primary : 'transparent'};
    border-radius: 3px 3px 0 0;
  }
`;

const ContentDetail = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('about');
  const [showTrailer, setShowTrailer] = useState(false);
  
  const { data: content, isLoading, error } = useQuery(['content', id], () => 
    api.get(`/content/${id}`).then(res => res.data)
  );
  
  if (isLoading) return <Loader />;
  if (error) return <Error message="Failed to load content details" />;
  
  const { 
    title, 
    backdrop_path, 
    poster_path, 
    overview, 
    release_date, 
    rating,
    type,
    runtime,
    genres,
    trailer_key
  } = content;
  
  const year = new Date(release_date).getFullYear();
  
  return (
    <Container>
      <Backdrop>
        <BackdropImage src={`https://image.tmdb.org/t/p/original${backdrop_path}`} alt={title} />
      </Backdrop>
      
      <ContentInfo>
        <Poster src={`https://image.tmdb.org/t/p/w500${poster_path}`} alt={title} />
        <Details>
          <Title>{title}</Title>
          <Meta>
            <span>{year}</span>
            <span>{type === 'movie' ? `${runtime} min` : 'TV Series'}</span>
            <span>{genres.join(', ')}</span>
            <Rating>
              <FaStar />
              <span>{rating.toFixed(1)}</span>
            </Rating>
          </Meta>
          <Overview>{overview}</Overview>
          
          <ActionButtons>
            <Button primary onClick={() => setShowTrailer(true)}>
              <FaPlay /> Watch Trailer
            </Button>
            {currentUser && (
              <>
                <Button>
                  <FaBookmark /> Watching
                </Button>
                <Button>
                  <FaCheck /> Completed
                </Button>
                <Button>
                  <FaClock /> Plan to Watch
                </Button>
              </>
            )}
          </ActionButtons>
        </Details>
      </ContentInfo>
      
      <ContentTabs>
        <TabButtons>
          <TabButton 
            active={activeTab === 'about'} 
            onClick={() => setActiveTab('about')}
          >
            About
          </TabButton>
          <TabButton 
            active={activeTab === 'soundtrack'} 
            onClick={() => setActiveTab('soundtrack')}
          >
            Soundtrack
          </TabButton>
          <TabButton 
            active={activeTab === 'comments'} 
            onClick={() => setActiveTab('comments')}
          >
            Comments
          </TabButton>
          <TabButton 
            active={activeTab === 'related'} 
            onClick={() => setActiveTab('related')}
          >
            Related
          </TabButton>
        </TabButtons>
        
        {activeTab === 'about' && (
          <div>
            {/* Content details, cast, crew, etc. */}
          </div>
        )}
        
        {activeTab === 'soundtrack' && (
          <SoundtrackList contentId={id} />
        )}
        
        {activeTab === 'comments' && (
          <ContentComments contentId={id} />
        )}
        
        {activeTab === 'related' && (
          <RelatedContent contentId={id} type={type} />
        )}
      </ContentTabs>
      
      {showTrailer && (
        <TrailerModal 
          trailerKey={trailer_key} 
          onClose={() => setShowTrailer(false)} 
        />
      )}
    </Container>
  );
};

export default ContentDetail;

// src/components/soundtrack/SoundtrackList.js
import React from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import { FaSpotify, FaPlay, FaPlus } from 'react-icons/fa';
import api from '../../utils/api';
import Loader from '../common/Loader';
import Error from '../common/Error';

const Container = styled.div`
  margin-bottom: 30px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  font-size: 22px;
  font-weight: 600;
  margin: 0;
`;

const SpotifyConnect = styled.button`
  background: #1DB954;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: #1AA34A;
  }
`;

const TrackList = styled.div`
  display: grid;
  gap: 15px;
`;

const Track = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
  background: ${props => props.theme.cardBg};
  border-radius: 8px;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const TrackImage = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 4px;
  object-fit: cover;
`;

const TrackInfo = styled.div`
  flex: 1;
  margin-left: 15px;
`;

const TrackName = styled.h4`
  margin: 0 0 5px 0;
  font-size: 16px;
  font-weight: 500;
`;

const ArtistName = styled.div`
  font-size: 14px;
  color: ${props => props.theme.textSecondary};
`;

const TrackTimestamp = styled.