const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Configuration
const DATA_FILE = path.join(__dirname, 'courses.json');
const PORT = 5000;

// Middleware
app.use(cors()); // Enable CORS so browser frontend can call this API
app.use(express.json()); // Middleware to parse JSON request bodies

// Helper function to load courses from JSON file
function loadCourses() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
        return [];
    }
    
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error loading courses:', error);
        return [];
    }
}

// Helper function to save courses to JSON file
function saveCourses(courses) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(courses, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving courses:', error);
        return false;
    }
}

// Get next available ID
function getNextId(courses) {
    if (courses.length === 0) {
        return 1;
    }
    return Math.max(...courses.map(c => c.id)) + 1;
}

// Date validation helper (YYYY-MM-DD)
function isValidDate(dateString) {
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if(!dateString.match(regEx)) return false;  // Invalid format
    const d = new Date(dateString);
    const dNum = d.getTime();
    if(!dNum && dNum !== 0) return false; // NaN value, i.e. Invalid date
    return d.toISOString().slice(0, 10) === dateString;
}

// GET all courses
app.get('/api/courses', (req, res) => {
    try {
        const courses = loadCourses();
        res.status(200).json({
            success: true,
            count: courses.length,
            courses: courses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Failed to retrieve courses: ${error.message}`
        });
    }
});

// GET statistics endpoint
app.get('/api/courses/stats', (req, res) => {
    try {
        const courses = loadCourses();
        const stats = {
            total: courses.length,
            notStarted: courses.filter(c => c.status === 'Not Started').length,
            inProgress: courses.filter(c => c.status === 'In Progress').length,
            completed: courses.filter(c => c.status === 'Completed').length
        };
        res.status(200).json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Failed to retrieve statistics: ${error.message}`
        });
    }
});

// GET specific course by ID
app.get('/api/courses/:id', (req, res) => {
    try {
        const courseId = parseInt(req.params.id, 10);
        const courses = loadCourses();
        const course = courses.find(c => c.id === courseId);
        
        if (course) {
            res.status(200).json({
                success: true,
                course: course
            });
        } else {
            res.status(404).json({
                success: false,
                error: `Course with ID ${courseId} not found`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Failed to retrieve course: ${error.message}`
        });
    }
});

// POST new course
app.post('/api/courses', (req, res) => {
    try {
        const data = req.body;
        
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No data provided'
            });
        }
        
        // Validate required fields
        const requiredFields = ['name', 'description', 'target_date', 'status'];
        const missingFields = requiredFields.filter(field => !data[field] || (typeof data[field] === 'string' && data[field].trim() === ''));
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        
        // Validate date format (YYYY-MM-DD)
        if (!isValidDate(data.target_date)) {
            return res.status(400).json({
                success: false,
                error: 'Target date must be a valid date in YYYY-MM-DD format.'
            });
        }
        
        // Validate status
        const validStatuses = ['Not Started', 'In Progress', 'Completed'];
        if (!validStatuses.includes(data.status)) {
            return res.status(400).json({
                success: false,
                error: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }
        
        const courses = loadCourses();
        
        const newCourse = {
            id: getNextId(courses),
            name: data.name.trim(),
            description: data.description.trim(),
            target_date: data.target_date,
            status: data.status,
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
        
        courses.push(newCourse);
        
        if (saveCourses(courses)) {
            res.status(201).json({
                success: true,
                message: 'Course added successfully',
                course: newCourse
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save course'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Failed to add course: ${error.message}`
        });
    }
});

// PUT update course by ID
app.put('/api/courses/:id', (req, res) => {
    try {
        const courseId = parseInt(req.params.id, 10);
        const data = req.body;
        
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No data provided'
            });
        }
        
        const courses = loadCourses();
        const courseIndex = courses.findIndex(c => c.id === courseId);
        
        if (courseIndex === -1) {
            return res.status(404).json({
                success: false,
                error: `Course with ID ${courseId} not found`
            });
        }
        
        const course = courses[courseIndex];

        // Validate status if being updated
        if (data.status) {
            const validStatuses = ['Not Started', 'In Progress', 'Completed'];
            if (!validStatuses.includes(data.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Status must be one of: ${validStatuses.join(', ')}`
                });
            }
            course.status = data.status;
        }

        // Validate and update target_date if provided
        if (data.target_date) {
            if (!isValidDate(data.target_date)) {
                return res.status(400).json({
                    success: false,
                    error: 'Target date must be a valid date in YYYY-MM-DD format.'
                });
            }
            course.target_date = data.target_date;
        }
        
        // Update remaining fields
        if (data.name !== undefined) {
            if (typeof data.name !== 'string' || data.name.trim() === '') {
                return res.status(400).json({ success: false, error: 'Name cannot be empty.' });
            }
            course.name = data.name.trim();
        }
        if (data.description !== undefined) {
            if (typeof data.description !== 'string' || data.description.trim() === '') {
                return res.status(400).json({ success: false, error: 'Description cannot be empty.' });
            }
            course.description = data.description.trim();
        }
        
        courses[courseIndex] = course;
        
        if (saveCourses(courses)) {
            res.status(200).json({
                success: true,
                message: 'Course updated successfully',
                course: course
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save changes'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Failed to update course: ${error.message}`
        });
    }
});

// DELETE course by ID
app.delete('/api/courses/:id', (req, res) => {
    try {
        const courseId = parseInt(req.params.id, 10);
        const courses = loadCourses();
        const courseIndex = courses.findIndex(c => c.id === courseId);
        
        if (courseIndex === -1) {
            return res.status(404).json({
                success: false,
                error: `Course with ID ${courseId} not found`
            });
        }
        
        const deletedCourse = courses.splice(courseIndex, 1)[0];
        
        if (saveCourses(courses)) {
            res.status(200).json({
                success: true,
                message: 'Course deleted successfully',
                deleted_course: deletedCourse
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save changes'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: `Failed to delete course: ${error.message}`
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('CodeCraftHub API is starting...');
    console.log('='.repeat(60));
    console.log(`Data will be stored in: ${path.resolve(DATA_FILE)}`);
    console.log(`API is available at: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('\nPress CTRL+C to stop the server\n');
});
