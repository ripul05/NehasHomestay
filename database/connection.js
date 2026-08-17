const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

const { Pool } = require("pg");

console.log(
    "DATABASE_URL exists:",
    Boolean(process.env.DATABASE_URL)
);

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

module.exports = pool;