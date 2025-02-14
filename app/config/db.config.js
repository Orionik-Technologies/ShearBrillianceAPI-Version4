
const pg = require('pg');
module.exports = {
  // postgresql://neondb_owner:npg_92gmBlhZGKfR@ep-noisy-heart-a6h3zgis-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
    HOST: "ep-noisy-heart-a6h3zgis-pooler.us-west-2.aws.neon.tech",
    USER: "neondb_owner",
    PASSWORD: "npg_92gmBlhZGKfR",
    DB: "neondb",
    dialect: "postgresql",
    dialectModule:pg,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      connectTimeout: 60000, // 60 seconds,
       ssl: {
         require: true,
        rejectUnauthorized: false
      },
      options: {
        sslmode: "require" // Setting sslmode in the options
      }
    }
  };