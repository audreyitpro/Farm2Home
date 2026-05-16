// backend/routes/chat.js

const express = require("express");

const router = express.Router();

router.get("/:conversationId", async (req, res) => {
  try {
    res.json({
      success: true,
      conversationId: req.params.conversationId,
      messages: [],
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

router.post("/send", async (req, res) => {
  try {
    const message = req.body;

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

module.exports = router;