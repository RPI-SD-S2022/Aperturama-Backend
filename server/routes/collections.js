const router = require('express').Router();
const {db} = require('../db');
const auth_media = require('../middleware/auth_media');
const auth_collection = require('../middleware/auth_collection');
const crypto = require('crypto');

// GET /collections - Retrieve list of user's collections
router.get('/', async(req, res) => {

	const query = await db.query('SELECT collection_id, name FROM aperturama.collection WHERE owner_user_id = $1', [req.user.sub]);
	// TODO: Error handling

	res.json(query.rows);

});

// POST /collections - Create a new collection
router.post('/', async(req, res) => {

	await db.query('INSERT INTO aperturama.collection (owner_user_id, name) VALUES ($1, $2)', [req.user.sub, req.body['name'] || 'Untitled']);
	// TODO: Error handling

	res.sendStatus(200);

});

// GET /collections/<id> - Get a collection and its media
router.get('/:id(\\d+)', auth_collection(), async(req, res) => {

	// Get collection metadata
	let query = await db.query('SELECT name FROM aperturama.collection WHERE collection_id = $1', [req.params['id']]);
	let collection = {name: query.rows[0]['name']};
	// TODO: Error handling

	// Get media in collection
	query = await db.query('SELECT media_id FROM aperturama.collection_media WHERE collection_id = $1', [req.params['id']]);
	collection['media'] = query.rows;
	// TODO: Error handling

	res.json(collection);

});

// PUT /collections/<id> - Update a collection (rename)
router.put('/:id(\\d+)', auth_collection(), async(req, res) => {

	// Update collection name
	await db.query('UPDATE aperturama.collection SET name = $1 WHERE collection_id = $2', [req.body['name'], req.params['id']]);
	// TODO: Error handling

	res.sendStatus(200);

});

// DELETE /collections/<id> - Delete a collection
router.delete('/:id(\\d+)', auth_collection(),async(req, res) => {

	// Delete collection
	await db.query('DELETE FROM aperturama.collection WHERE collection_id = $1', [req.params['id']]);
	// TODO: Error handling

	res.sendStatus(200);

});

// POST /collections/<id> - Add media to collection
router.post('/:id(\\d+)', auth_collection(), auth_media(), async(req, res) => {

	// Add media to collection
	try{
		await db.query('INSERT INTO aperturama.collection_media (collection_id, media_id) VALUES ($1, $2)', [req.params['id'], req.body['media_id']]);
	}catch(err){
		// Unique violation, meaning media is already in collection
		if(err.code == 23505){
			return res.sendStatus(304);
		}else{
			return res.sendStatus(500);
		}
	}

	res.sendStatus(200);

});

// DELETE /collections/<collectionid>/media/<mediaid> - Remove media from collection
router.delete('/:id(\\d+)/media/:mediaid(\\d+)', auth_collection(), async(req, res) => {

	// Remove media from collection
	await db.query('DELETE FROM aperturama.collection_media WHERE collection_id = $1 AND media_id = $2', [req.params['id'], req.params['mediaid']]);
	// TODO: Error handling

	res.sendStatus(200);

});

// POST /collections/<id>/share/user - Share collection with a user
router.post('/:id(\\d+)/share/user', auth_collection(), async(req, res) => {

	// Get shared user's ID from email
	const query = await db.query('SELECT user_id FROM aperturama.user WHERE email = $1', [req.body['email']]);
	// TODO: Error handling

	if(query.rows.length === 1){

		// Share collection with the user
		await db.query('INSERT INTO aperturama.collection_sharing (collection_id, shared_to_user_id) VALUES ($1, $2)', [req.params['id'], query.rows[0]['user_id']]);
		// TODO: Error handling

		res.sendStatus(200);

	}else{
		res.sendStatus(404);
	}

});

// DELETE /collections/<id>/share/user - Stop sharing collection with a user
router.delete('/:id(\\d+)/share/user', auth_collection(), async(req, res) => {

	await db.query('DELETE FROM aperturama.collection_sharing WHERE collection_id = $1 AND shared_to_user_id = $2', [req.params['id'], req.body['user_id']]);
	// TODO: Error handling

	res.sendStatus(200);

});

// POST /collections/<id>/share/link - Share collection with a link
router.post('/:id(\\d+)/share/link', auth_collection(), async(req, res) => {

	console.log(req.body);

	// Create random code for link if not given
	const code = req.body['code'] ?? crypto.randomBytes(32).toString('base64url');

	// Create link in database
	await db.query('INSERT INTO aperturama.collection_sharing (collection_id, shared_link_code, shared_link_password) VALUES ($1, $2, $3)', [req.params['id'], code, req.body['password'] ?? null]);
	// TODO: Error handling

	res.json({code: code});

});

// DELETE /collections/<id>/share/link/<code> - Stop sharing collection with a link
router.delete('/:id(\\d+)/share/link/:code', auth_collection(), async(req, res) => {

	// Delete shared link
	await db.query('DELETE FROM aperturama.collection_sharing WHERE collection_id = $1 AND shared_link_code = $2', [req.params['id'], req.params['code']]);
	// TODO: Error handling (invalid code)

	res.sendStatus(200);

});

// DELETE /collections/<id>/share - Stop sharing collection with anyone
router.delete('/:id(\\d+)/share', auth_collection(), async(req, res) => {

	// Delete collection sharing entries
	await db.query('DELETE FROM aperturama.collection_sharing WHERE collection_id = $1', [req.params['id']]);
	// TODO: Error handling

	res.sendStatus(200);

});

module.exports = router;
