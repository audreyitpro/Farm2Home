// backend/routes/freight.js

const express = require("express");

const router = express.Router();

router.get("/loads", async (req, res) => {
  try {
    res.json({
      success: true,
      loads: [],
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

router.post("/loads", async (req, res) => {
  try {
    const load = req.body;

    res.json({
      success: true,
      load,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

router.post("/tracking/update", async (req, res) => {
  try {
    const tracking = req.body;

    res.json({
      success: true,
      tracking,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

module.exports = router;