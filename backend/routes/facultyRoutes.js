const express = require('express');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

function serializeFaculty(facultyDoc) {
    const faculty = facultyDoc?.toObject ? facultyDoc.toObject() : facultyDoc;
    const adminRecord = faculty?.adminId && typeof faculty.adminId === 'object' ? faculty.adminId : null;

    return {
        _id: faculty?._id,
        name: faculty?.name || '',
        code: faculty?.code || '',
        createdAt: faculty?.createdAt || null,
        adminId: adminRecord?._id || faculty?.adminId || null,
        admin: adminRecord ? {
            _id: adminRecord._id,
            name: adminRecord.name,
            email: adminRecord.email,
            role: adminRecord.role,
            facultyId: adminRecord.facultyId
        } : null
    };
}

// GET /api/faculties - list all faculties (super admin only)
router.get('/', verifyToken, requireSuperAdmin, async (_req, res) => {
    try {
        const faculties = await Faculty.find()
            .populate('adminId', 'name email role facultyId')
            .sort({ createdAt: -1 });

        res.json(faculties.map(serializeFaculty));
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

        if (!/^[a-zA-Z0-9]+$/.test(code.trim())) {
            return res.status(400).json({ message: 'Faculty code must contain letters and numbers only.' });
        }
        if (!/^[a-zA-Z\s\u0600-\u06FF]+$/.test(adminName.trim())) {
            return res.status(400).json({ message: 'Admin name must contain text only (letters and spaces).' });
        }
        const customEmailRegex = /^[a-zA-Z]{3}[a-zA-Z0-9]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!customEmailRegex.test(adminEmail.trim())) {
            return res.status(400).json({ message: "Admin email 3 xaraf ee ugu horeya waa in ay yihiin text, waxana lasoo raacin karaa kaliya text iyo number (e.g. abc123@domain.com)." });
        }

        // create faculty first
        const faculty = await Faculty.create({ name: name.trim(), code: code.trim().toUpperCase() });

        // create faculty admin account
        const admin = await Admin.create({
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            password: adminPassword,
            role: 'admin',
            facultyId: faculty._id
        });

        faculty.adminId = admin._id;
        await faculty.save();

        const populatedFaculty = await Faculty.findById(faculty._id)
            .populate('adminId', 'name email role facultyId');

        res.status(201).json(serializeFaculty(populatedFaculty));
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Faculty code or admin email already exists.' });
        }
        console.error('Create faculty error:', error);
        res.status(500).json({ message: 'Error creating faculty.' });
    }
});

// PUT /api/faculties/:id - update faculty and its admin account (super admin only)
router.put('/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { name, code, adminName, adminEmail, adminPassword } = req.body;

        if (!name || !code || !adminName || !adminEmail) {
            return res.status(400).json({ message: 'Name, code, and admin identity are required.' });
        }

        if (!/^[a-zA-Z0-9]+$/.test(String(code).trim())) {
            return res.status(400).json({ message: 'Faculty code must contain letters and numbers only.' });
        }
        if (!/^[a-zA-Z\s\u0600-\u06FF]+$/.test(String(adminName).trim())) {
            return res.status(400).json({ message: 'Admin name must contain text only (letters and spaces).' });
        }
        const customEmailRegex = /^[a-zA-Z]{3}[a-zA-Z0-9]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!customEmailRegex.test(String(adminEmail).trim())) {
            return res.status(400).json({ message: "Admin email 3 xaraf ee ugu horeya waa in ay yihiin text, waxana lasoo raacin karaa kaliya text iyo number (e.g. abc123@domain.com)." });
        }

        const faculty = await Faculty.findById(req.params.id).populate('adminId');
        if (!faculty) {
            return res.status(404).json({ message: 'Faculty not found.' });
        }

        const normalizedName = String(name).trim();
        const normalizedCode = String(code).trim().toUpperCase();
        const normalizedAdminName = String(adminName).trim();
        const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();
        const nextPassword = typeof adminPassword === 'string' ? adminPassword.trim() : '';

        const duplicateFaculty = await Faculty.findOne({
            _id: { $ne: faculty._id },
            code: normalizedCode
        }).select('_id');
        if (duplicateFaculty) {
            return res.status(400).json({ message: 'Faculty code already exists.' });
        }

        let admin = faculty.adminId || null;

        const duplicateAdmin = await Admin.findOne({
            _id: { $ne: admin?._id || null },
            email: normalizedAdminEmail
        }).select('_id');
        if (duplicateAdmin) {
            return res.status(400).json({ message: 'Admin email already exists.' });
        }

        faculty.name = normalizedName;
        faculty.code = normalizedCode;

        if (admin) {
            admin.name = normalizedAdminName;
            admin.email = normalizedAdminEmail;
            if (nextPassword) {
                admin.password = nextPassword;
            }
            admin.facultyId = faculty._id;
            await admin.save();
        } else {
            if (!nextPassword) {
                return res.status(400).json({ message: 'Admin password is required when creating the faculty administrator.' });
            }

            admin = await Admin.create({
                name: normalizedAdminName,
                email: normalizedAdminEmail,
                password: nextPassword,
                role: 'admin',
                facultyId: faculty._id
            });
            faculty.adminId = admin._id;
        }

        await faculty.save();

        const updatedFaculty = await Faculty.findById(faculty._id)
            .populate('adminId', 'name email role facultyId');

        res.json(serializeFaculty(updatedFaculty));
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Faculty code or admin email already exists.' });
        }
        console.error('Update faculty error:', error);
        res.status(500).json({ message: 'Error updating faculty.' });
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
