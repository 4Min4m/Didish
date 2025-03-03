// server.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const config = require('./config');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// Routes
app.use('/api', routes);

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
});

// config/index.js
require('dotenv').config();

module.exports = {
  development: {
    database: {
      name: process.env.DB_NAME || 'didi_dev',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      dialect: 'postgres'
    },
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_key',
    tmdbApiKey: process.env.TMDB_API_KEY,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET
  },
  production: {
    database: {
      name: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      dialect: 'postgres'
    },
    jwtSecret: process.env.JWT_SECRET,
    tmdbApiKey: process.env.TMDB_API_KEY,
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET
  }
}[process.env.NODE_ENV || 'development'];

// models/index.js
const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(
  config.database.name,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    dialect: config.database.dialect,
    logging: false
  }
);

const db = {
  User: require('./user')(sequelize),
  Content: require('./content')(sequelize),
  Soundtrack: require('./soundtrack')(sequelize),
  UserList: require('./userList')(sequelize),
  Comment: require('./comment')(sequelize),
  Franchise: require('./franchise')(sequelize),
  FranchiseContent: require('./franchiseContent')(sequelize),
  ForumTopic: require('./forumTopic')(sequelize),
  ForumPost: require('./forumPost')(sequelize),
  UserAchievement: require('./userAchievement')(sequelize),
  Notification: require('./notification')(sequelize),
  Playlist: require('./playlist')(sequelize),
  PlaylistTrack: require('./playlistTrack')(sequelize)
};

// Define associations
db.User.hasMany(db.UserList);
db.UserList.belongsTo(db.User);

db.Content.hasMany(db.UserList);
db.UserList.belongsTo(db.Content);

db.Content.hasMany(db.Soundtrack);
db.Soundtrack.belongsTo(db.Content);

db.User.hasMany(db.Comment);
db.Comment.belongsTo(db.User);

db.Content.hasMany(db.Comment);
db.Comment.belongsTo(db.Content);

db.Franchise.hasMany(db.FranchiseContent);
db.Content.hasMany(db.FranchiseContent);
db.FranchiseContent.belongsTo(db.Franchise);
db.FranchiseContent.belongsTo(db.Content);

db.User.hasMany(db.ForumTopic);
db.ForumTopic.belongsTo(db.User);

db.User.hasMany(db.ForumPost);
db.ForumPost.belongsTo(db.User);
db.ForumTopic.hasMany(db.ForumPost);
db.ForumPost.belongsTo(db.ForumTopic);

db.User.hasMany(db.UserAchievement);
db.UserAchievement.belongsTo(db.User);

db.User.hasMany(db.Notification);
db.Notification.belongsTo(db.User);

db.User.hasMany(db.Playlist);
db.Playlist.belongsTo(db.User);

db.Playlist.hasMany(db.PlaylistTrack);
db.Soundtrack.hasMany(db.PlaylistTrack);
db.PlaylistTrack.belongsTo(db.Playlist);
db.PlaylistTrack.belongsTo(db.Soundtrack);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

// models/user.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 30]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCreate: async (user) => {
        user.password = await bcrypt.hash(user.password, 10);
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  User.prototype.comparePassword = async function(password) {
    return bcrypt.