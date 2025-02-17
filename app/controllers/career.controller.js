const db = require("../models");
const Career = db.Career;
const sendResponse = require('../helpers/responseHelper');
const { put } = require('@vercel/blob');
const fs = require('fs');
const { Op } = require("sequelize");
const AWS = require('aws-sdk');
const validateInput = require('../helpers/validatorHelper');
const { sendEmail } = require("../services/emailService");
const { CREATE_CAREER_TEMPLATE_ID, CONTACT_US_MAIL } = require("../config/sendGridConfig");


const s3 = new AWS.S3({
    endpoint: new AWS.Endpoint('https://tor1.digitaloceanspaces.com'),
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

exports.create = async (req, res) => {
    try {
        let { 
            fullName, 
            mobileNo, 
            email, 
            coreSkills, 
            additionalSkills, 
            totalExperience, 
            currentCompany, 
            currentSalary, 
            expectedSalary, 
            noticePeriod, 
            currentLocation, 
            reasonForChange, 
            aboutYou, 
            source,
            referredBy 
        } = req.body;
        
        let resumeUrl = null;

        // Validate required fields
        if (!fullName || !mobileNo || !email || !coreSkills || !totalExperience || 
            !currentCompany || !currentSalary || !expectedSalary || !noticePeriod || 
            !currentLocation || !reasonForChange || !aboutYou || !source || !req.file) {
            return sendResponse(res, false, 'All required fields must be provided', null, 400);
        }

        // Validate email
        if (!validateInput(email, 'email')) {
            return sendResponse(res, false, 'Invalid email format', null, 400);
        }

        // Validate mobile number
        if (!validateInput(mobileNo, 'mobile_number')) {
            return sendResponse(res, false, 'Invalid mobile number format', null, 400);
        }

        // Handle resume upload
        if (req.file) {
            const fileBuffer = req.file.buffer;
            
            // Validate file type (PDF or DOC/DOCX only)
            const allowedMimeTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowedMimeTypes.includes(req.file.mimetype)) {
                return sendResponse(res, false, 'Only PDF and Word documents are allowed!', null, 400);
            }

            // Upload to DigitalOcean Spaces
            const params = {
                Bucket: process.env.DO_SPACES_BUCKET,
                Key: `career-resumes/${Date.now()}-${req.file.originalname}`,
                Body: fileBuffer,
                ACL: 'public-read',
                ContentType: req.file.mimetype
            };

            try {
                const uploadResult = await s3.upload(params).promise();
                resumeUrl = uploadResult.Location;
            } catch (error) {
                console.error('Error uploading resume:', error);
                return sendResponse(res, false, 'Failed to upload resume', error.message, 500);
            }
        }

        // Handle coreSkills - ensure it's an array
        if (coreSkills && !Array.isArray(coreSkills)) {
            try {
                // Check if it's a JSON string
                if (typeof coreSkills === 'string' && coreSkills.startsWith('[')) {
                    coreSkills = JSON.parse(coreSkills);
                } else {
                    coreSkills = coreSkills.split(',').map(skill => skill.trim());
                }
            } catch (error) {
                return sendResponse(res, false, 'Invalid format for core skills', null, 400);
            }
        }

        // Handle additionalSkills - ensure it's a string
        if (additionalSkills) {
            if (Array.isArray(additionalSkills)) {
                additionalSkills = additionalSkills.join(', ');
            } else if (typeof additionalSkills === 'object') {
                additionalSkills = Object.values(additionalSkills).join(', ');
            }
        }

        // Convert salary values to float
        currentSalary = parseFloat(currentSalary);
        expectedSalary = parseFloat(expectedSalary);
        totalExperience = parseFloat(totalExperience);

        // Validate notice period
        const validNoticePeriods = ["Immediate", "15 Days", "30 Days", "60 Days", "90 Days"];
        if (!validNoticePeriods.includes(noticePeriod)) {
            return sendResponse(res, false, 'Invalid notice period', null, 400);
        }

        // Create the career record
        const career = await Career.create({
            fullName,
            mobileNo,
            email,
            coreSkills,
            additionalSkills,
            totalExperience,
            currentCompany,
            currentSalary,
            expectedSalary,
            noticePeriod,
            currentLocation,
            reasonForChange,
            aboutYou,
            source,
            referredBy,
            resume: resumeUrl,
            status: "Pending"
        });

        const emailData = {
            fullName : fullName,
            email : email,
            mobileNo : mobileNo,
            coreSkills : coreSkills,
            additionalSkills : additionalSkills,
            totalExperience : totalExperience,
            currentCompany : currentCompany,
            currentSalary : currentSalary,
            expectedSalary : expectedSalary,
            noticePeriod : noticePeriod,
            currentLocation : currentLocation,
            reasonForChange : reasonForChange,
            aboutYou : aboutYou,
            source : source,
            referredBy : referredBy,
            resume : resumeUrl,
            company_name: 'Shear Brilliance',  // Customize with your company name
            currentYear: new Date().getFullYear()
        }

        console.log('Email Data:', emailData);

        await sendEmail(CONTACT_US_MAIL, "New Career Profile Created", CREATE_CAREER_TEMPLATE_ID, emailData);

        console.log('Career profile created successfully:', career);

        return sendResponse(res, true, 'Career profile created successfully', { career }, 201);
    } catch (error) {
        console.error('Error creating career profile:', error);
        return sendResponse(res, false, error.message || 'An error occurred while creating the career profile', null, 500);
    }
};
