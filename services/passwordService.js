const bcrypt = require('bcrypt');

const hashPassword = (password) => bcrypt.hash(password, 10);
const comparePassword = (plainPassword, hashedPassword) => bcrypt.compare(plainPassword, hashedPassword);

module.exports = { hashPassword, comparePassword };
