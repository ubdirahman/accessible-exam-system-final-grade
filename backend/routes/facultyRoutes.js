const express = require('express');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/faculties - list all faculties (super admin only)
router.get('/', verifyToken, requireSuperAdmin, async (_req, res) => {
    try {
        const faculties = await Faculty.find().sort({ createdAt: -1 });
        res.json(faculties);
    } catch (error) {
        console.error('Fetch faculties error:', error);
        res.status(500).json({ message: 'Error fetching faculties.' });
    }
});

// POST /api/faculties - create faculty + its admin account (super admin only)
router.post('/', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { name, code, adminName, adminEmail, adminPassword } = req.body;
        if (!name || !code || !adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({ message: 'Name, code, and admin credentials are required.' });
        }

        // create faculty first
        const faculty = await Faculty.create({ name, code });

        // create faculty admin account
        const admin = await Admin.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            facultyId: faculty._id
        });

        faculty.adminId = admin._id;
        await faculty.save();

        res.status(201).json({
            faculty,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                facultyId: admin.facultyId
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Faculty code or admin email already exists.' });
        }
        console.error('Create faculty error:', error);
        res.status(500).json({ message: 'Error creating faculty.' });
    }
});

// DELETE /api/faculties/:id - remove faculty and its admin (super admin only)
router.delete('/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const faculty = await Faculty.findById(req.params.id);
        if (!faculty) return res.status(404).json({ message: 'Faculty not found.' });

        if (faculty.adminId) {
            await Admin.findByIdAndDelete(faculty.adminId);
        }
        await Faculty.findByIdAndDelete(faculty._id);

        res.json({ message: 'Faculty deleted.' });
    } catch (error) {
        console.error('Delete faculty error:', error);
        res.status(500).json({ message: 'Error deleting faculty.' });
    }
});

module.exports = router;
