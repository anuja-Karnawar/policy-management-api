const express = require('express');
const { searchPolicyByUsername, aggregatePoliciesByUser } = require('../controllers/policy.controller');

const router = express.Router();

// GET /api/policies/search?username=<email or firstName>
router.get('/search', searchPolicyByUsername);

// GET /api/policies/aggregate - policy totals rolled up per user
router.get('/aggregate', aggregatePoliciesByUser);

module.exports = router;
