const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const keys = require("../../../config/keys");
const passport = require("passport");
const User = require('../../models/User.model');

// Modified authentication code from https://github.com/rishipr/mern-auth/

// Load input validation
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");

// Load async wrapper function
const handleAsyncError = require('../../middleware/handleAsyncError');

/**
 * @route POST api/users/register
 * @desc Register user
 * @access Public
 */
router.post("/register", (req, res) => {
  // Form validation
  const { errors, isValid } = validateRegisterInput(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  User.findOne({ email: req.body.email }).then(user => {
    if (user) {
      return res.status(400).json({ email: "Email already exists" });
    } 
    else {
      const newUser = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password
      });

      // Hash password before saving in database
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json(user))
            .catch(err => console.log(err));
        });
      });
    }
  });
});


/**
 * @route POST api/users/login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post("/login", (req, res) => {
  // Form validation
  const { errors, isValid } = validateLoginInput(req.body);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;
  const password = req.body.password;

  // Find user by email
  User.findOne({ email }).then(user => {
    // Check if user exists
    if (!user) {
      return res.status(404).json({ emailnotfound: "Email not found" });
    }

    // Check password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name,
          role: user.role,
        };

        // Sign token 
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: 31556926 // 1 year in seconds
          },
          (err, token) => {
            res.json({
              success: true,
              token: "Bearer " + token
            });
          }
        );
      } 
      else {
        return res.status(400).json({ passwordincorrect: "Password incorrect" });
      }
    });
  });
});


/**
 * @route GET /api/users
 * @desc Retrieves all users
 * @access Admin
 */
router.get('/', passport.authenticate('admin', { session : false }), handleAsyncError(async (req, res) => {
  res.json(await User.find({}));
}));
 

/**
 * @route GET /api/users/{userId}
 * @desc Retrieve specified user  
 * @access Private
 */
router.get('/:userId', passport.authenticate('personal', { session : false }), handleAsyncError(async (req, res) => {
  res.json(await User.findById(req.params.userId));   
}));    

// TODO
// @route PUT /api/users/{userId} 
// @desc Update the specified user
// @access Private

// TODO
// @route DELETE /api/users/{userId}
// @desc Delete specified user
// @access Private 
 

/**
 * @route GET /api/users/{userId}/activities
 * @desc Retrieves the activities of the specified user
 * @access Private
 */
router.get('/:userId/activities', passport.authenticate('personal', { session : false }), handleAsyncError(async (req, res) => {
  res.json(await Activity.find({ userId: req.params.userId }));
}));


/**
 * @route POST api/users/{userId}/activities
 * @desc Create a new activity for the specified user
 * @access Private
 */
router.post('/:userId/activities/', passport.authenticate('personal', { session: false }), handleAsyncError( async (req, res) => {
  const userId = req.params.userId;
  const { title, goal } = req.body;
  const newActivity = new Activity({ userId, title, goal });

  // Add the new activity to DB
  await newActivity.save();
  // Add reference to the new activity to the user
  await User.findOneAndUpdate(
      {_id: userId}, 
      {$push: {activities: newActivity._id}},
      {new: true},
  );
  res.json(newActivity);
}));


/**
 * @route DELETE /api/users/{userId}/activities/{activityId}
 * @desc Delete specified activity of user
 * @access Private
 */
router.delete('/:userId/activities/:activityId', passport.authenticate('personal', { session : false }), handleAsyncError(async (req, res) => {
  const activityId = req.params.activityId;
  await Activity.findByIdAndDelete(activityId);

  // Remove from User model
  await User.findOneAndUpdate(
      {_id: req.params.userId},
      {$pull: {activities: activityId}},
  )
  res.json(`Success: deleted activity ${activityId}`);
}));


/**
 * @route GET /api/users/{userId}/activites/{activityID}/logs
 * @desc Retrieve all logs for specified activity
 * @route Private
 */
router.get('/:userId/activities/:activityId/logs', passport.authenticate('personal', { session: false }), handleAsyncError(async (req, res) => {
  res.json(await Log.find({ activityId: req.params.activityId }))
}));


module.exports = router;
