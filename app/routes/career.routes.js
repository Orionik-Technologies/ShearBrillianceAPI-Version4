const express = require('express');
const router = express.Router();
const careerController = require("../controllers/career.controller");
const upload = require('../config/multer.config.js');
const {
    authenticateJWT,
    authorizeRoles,
  } = require("../middleware/auth.middleware");
  const Career = require("../models/Career.model.js");

  module.exports = app => {
    const apiPrefix = "/api/career";
    /**
     * @swagger
     * tags:
     *  name: Career
     *  description: Career management
     */

    
/**
 * @swagger
 * /api/career/create:
 *   post:
 *     summary: Create a new career profile
 *     tags: [Career]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - mobileNo
 *               - email
 *               - coreSkills
 *               - totalExperience
 *               - currentCompany
 *               - currentLocation
 *               - currentSalary
 *               - expectedSalary
 *               - noticePeriod
 *               - reasonForChange
 *               - aboutYou
 *               - source
 *               - resume
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Full name of the applicant (letters and spaces only)
 *                 example: "John Doe"
 *               mobileNo:
 *                 type: string
 *                 description: Mobile number of the applicant
 *                 example: "+1234567890"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the applicant (must be unique)
 *                 example: "john.doe@example.com"
 *               coreSkills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Core skills of the applicant (can be comma-separated string or array)
 *                 example: ["JavaScript", "Node.js", "SQL"]
 *               additionalSkills:
 *                 type: string
 *                 description: Additional skills of the applicant (comma-separated)
 *                 example: "AWS, Docker, Kubernetes"
 *               totalExperience:
 *                 type: number
 *                 format: float
 *                 description: Total years of experience
 *                 example: 5.5
 *               currentCompany:
 *                 type: string
 *                 description: Current company where the applicant works
 *                 example: "ABC Corp"
 *               currentSalary:
 *                 type: number
 *                 format: float
 *                 description: Current annual salary of the applicant
 *                 example: 60000
 *               expectedSalary:
 *                 type: number
 *                 format: float
 *                 description: Expected annual salary of the applicant
 *                 example: 70000
 *               noticePeriod:
 *                 type: string
 *                 enum: ["Immediate", "15 Days", "30 Days", "60 Days", "90 Days"]
 *                 description: Notice period for the current job
 *                 example: "30 Days"
 *               currentLocation:
 *                 type: string
 *                 description: Current location of the applicant
 *                 example: "New York"
 *               reasonForChange:
 *                 type: string
 *                 description: Reason for seeking a job change
 *                 example: "Looking for better opportunities and career growth"
 *               aboutYou:
 *                 type: string
 *                 description: A brief description about the applicant
 *                 example: "I am a passionate developer with 5 years of experience in full-stack development"
 *               source:
 *                 type: string
 *                 description: The source from which the applicant learned about the job
 *                 example: "LinkedIn"
 *               referredBy:
 *                 type: string
 *                 description: Name of the person who referred the applicant (optional)
 *                 example: "Jane Smith"
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Upload the applicant's resume (PDF, DOC, or DOCX only)
 *     responses:
 *       201:
 *         description: Career profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Career profile created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     career:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: "f2b6341d-75f8-45b0-bb1f-d9fd66b78f39"
 *                         fullName:
 *                           type: string
 *                           example: "John Doe"
 *                         mobileNo:
 *                           type: string
 *                           example: "+1234567890"
 *                         email:
 *                           type: string
 *                           example: "john.doe@example.com"
 *                         coreSkills:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["JavaScript", "Node.js", "SQL"]
 *                         additionalSkills:
 *                           type: string
 *                           example: "AWS, Docker, Kubernetes"
 *                         totalExperience:
 *                           type: number
 *                           format: float
 *                           example: 5.5
 *                         currentCompany:
 *                           type: string
 *                           example: "ABC Corp"
 *                         currentSalary:
 *                           type: number
 *                           format: float
 *                           example: 60000
 *                         expectedSalary:
 *                           type: number
 *                           format: float
 *                           example: 70000
 *                         noticePeriod:
 *                           type: string
 *                           example: "30 Days"
 *                         currentLocation:
 *                           type: string
 *                           example: "New York"
 *                         reasonForChange:
 *                           type: string
 *                           example: "Looking for better opportunities and career growth"
 *                         aboutYou:
 *                           type: string
 *                           example: "I am a passionate developer with 5 years of experience in full-stack development"
 *                         source:
 *                           type: string
 *                           example: "LinkedIn"
 *                         referredBy:
 *                           type: string
 *                           example: "Jane Smith"
 *                         resume:
 *                           type: string
 *                           example: "https://digitalocean.com/spaces/career-resumes/12345678-johndoe-resume.pdf"
 *                         status:
 *                           type: string
 *                           enum: ["Pending", "Reviewed", "Shortlisted", "Rejected", "Hired"]
 *                           example: "Pending"
 *       400:
 *         description: Invalid input or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "All required fields must be provided"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 400
 *       409:
 *         description: Conflict error (e.g., Email already exists)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email already exists"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 409
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "An error occurred while creating the career profile"
 *                 data:
 *                   type: null
 *                 code:
 *                   type: integer
 *                   example: 500
 */
    app.post(
    `${apiPrefix}/create`, 
    upload.single("resume"),
    careerController.create
);


}
