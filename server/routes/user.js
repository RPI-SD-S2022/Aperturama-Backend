const express = require('express');
const router = express.Router();
const {db} = require('../db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require("fs");

// Hash and salt password using scrypt
function hash(password, salt = crypto.randomBytes(32)){
	return new Promise((resolve, reject) => {

		crypto.scrypt(password.normalize(), salt, 64, async(err, derivedKey) => {
			if(err) reject(err);
			resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
		});

	});
}

// POST /user - Create new user account
router.post('/', async(req, res) => {

	try{

		// Hash and salt password
		const hashString = await hash(req.body['password']);

		// Create new user in database
		const result = await db.query('INSERT INTO aperturama.user (email, first_name, last_name, password) VALUES ($1, $2, $3, $4)', [req.body['email'], req.body['first_name'], req.body['last_name'], hashString]);
		// TODO: Error handling (user already exists)

		res.sendStatus(200);

	}catch(err){
		res.sendStatus(500);
	}

});

// POST /user/login - Authenticate and get token
router.post('/login', async(req, res) => {

	// Get user information from database
	const result = await db.query('SELECT user_id, password FROM aperturama.user WHERE email = $1', [req.body['email']]);
	// TODO: Error handling

	if(result.rows.length === 1){

		// Check password
		const salt = Buffer.from(result.rows[0]['password'].split(':')[0], 'hex');
		if(await hash(req.body['password'], salt) === result.rows[0]['password']){

			// Generate JWT
			const token = jwt.sign({
				sub: result.rows[0]['user_id']
			}, fs.readFileSync(process.env['JWT_KEY']), {algorithm: 'HS256'});

			res.send(token);

		}else{
			res.sendStatus(401);
		}

	}else{
		res.sendStatus(401);
	}

});

// GET /user - Get user metadata
router.get('/', async(req, res) => {

	// Get user information from database
	const result = await db.query('SELECT user_id, email, first_name, last_name FROM aperturama.user WHERE user_id = $1', [req.user['sub']]);
	// TODO: Error handling

	res.json(result.rows[0]);

});

module.exports = router
