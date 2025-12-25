const express = require('express');
const router = express.Router();

const geoController = require('../controllers/geoController');

// Public endpoints (no auth) — used for address helpers and map preview.
router.get('/search', geoController.searchAddress);
router.get('/reverse', geoController.reverseGeocode);
router.get('/route', geoController.getRoute);

module.exports = router;
