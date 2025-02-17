const validateInput = require('../helpers/validatorHelper'); // Import the validation utility

module.exports = (sequelize, Sequelize) => {
    const Career = sequelize.define("Career", {
        id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        fullName: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
                isValidName(value) {
                    if (!validateInput(value, "nameRegex")) {
                        throw new Error("Full name must contain only letters and spaces.");
                    }
                }
            }
        },
        mobileNo: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
                isValidMobile(value) {
                    if (!validateInput(value, "mobile_number")) {
                        throw new Error("Invalid mobile number format.");
                    }
                }
            }
        },
        email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
                isValidEmail(value) {
                    if (!validateInput(value, "email")) {
                        throw new Error("Invalid email format.");
                    }
                }
            }
        },
        coreSkills: {
            type: Sequelize.ARRAY(Sequelize.STRING),
            allowNull: false,
        },
        additionalSkills: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        totalExperience: {
            type: Sequelize.FLOAT,
            allowNull: false,
        },
        currentCompany: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        currentSalary: {
            type: Sequelize.FLOAT,
            allowNull: false,
        },
        expectedSalary: {
            type: Sequelize.FLOAT,
            allowNull: false,
        },
        noticePeriod: {
            type: Sequelize.ENUM("Immediate", "15 Days", "30 Days", "60 Days", "90 Days"),
            allowNull: false,
        },
        currentLocation: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
                isValidAddress(value) {
                    if (!validateInput(value, "address")) {
                        throw new Error("Invalid address format.");
                    }
                }
            }
        },
        reasonForChange: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        resume: {
            type: Sequelize.STRING,
            allowNull: false,
            validate: {
                isValidFile(value) {
                    const allowedExtensions = ['.pdf', '.doc', '.docx'];
                    const fileExtension = value.slice(((value.lastIndexOf(".") - 1) >>> 0) + 2);
                    if (!allowedExtensions.includes(`.${fileExtension}`)) {
                        throw new Error("Resume must be a PDF or Word document.");
                    }
                }
            }
        },
        aboutYou: {
            type: Sequelize.TEXT,
            allowNull: false,
        },
        source: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        referredBy: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        status: {
            type: Sequelize.ENUM("Pending", "Reviewed", "Shortlisted", "Rejected", "Hired"),
            defaultValue: "Pending",
        },
    });

    return Career;
};
