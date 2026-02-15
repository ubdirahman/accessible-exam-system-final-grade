/**
 * Seed script — creates demo admin, students, and a sample exam
 * Run: node seed.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Admin = require('./models/Admin');
const Student = require('./models/Student');
const Exam = require('./models/Exam');
const Section = require('./models/Section');
const Question = require('./models/Question');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Admin.deleteMany({});
        await Student.deleteMany({});
        await Exam.deleteMany({});
        await Section.deleteMany({});
        await Question.deleteMany({});
        console.log('Cleared existing data');

        // Create admin
        const admin = await Admin.create({
            name: 'System Admin',
            email: 'admin@gmail.com',
            password: 'admin123'
        });
        console.log('Admin created: admin@gmail.com / admin123');

        // Create students
        const students = await Student.insertMany([
            {
                name: 'Ahmed Hassan',
                studentId: 'STU001',
                email: 'ahmed@student.com',
                accessibilitySettings: { highContrast: true, fontSize: 'large', speechRate: 1.0 }
            },
            {
                name: 'Sara Mohammed',
                studentId: 'STU002',
                email: 'sara@student.com',
                accessibilitySettings: { highContrast: true, fontSize: 'x-large', speechRate: 0.8 }
            },
            {
                name: 'Omar Ali',
                studentId: 'STU003',
                email: 'omar@student.com',
                accessibilitySettings: { highContrast: false, fontSize: 'large', speechRate: 1.2 }
            }
        ]);
        console.log('Students created: STU001, STU002, STU003');

        // Create exam
        const exam = await Exam.create({
            title: 'Introduction to Computer Science',
            description: 'Midterm exam covering basic CS concepts, programming fundamentals, and algorithms.',
            timeLimit: 60,
            createdBy: admin._id,
            active: true,
            examCodes: [
                { code: 'EXAM2024A', used: false, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
                { code: 'EXAM2024B', used: false, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
                { code: 'EXAM2024C', used: false, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
            ]
        });

        // Section 1: Multiple Choice
        const section1 = await Section.create({ examId: exam._id, name: 'Part 1: Multiple Choice', order: 1 });
        exam.sections.push(section1._id);

        await Question.insertMany([
            {
                examId: exam._id, sectionId: section1._id, type: 'mcq', order: 1, points: 2,
                questionText: 'What does CPU stand for?',
                options: [
                    { label: 'A', text: 'Central Processing Unit' },
                    { label: 'B', text: 'Central Program Utility' },
                    { label: 'C', text: 'Computer Processing Unit' },
                    { label: 'D', text: 'Central Processor Utility' }
                ],
                correctAnswer: 'A'
            },
            {
                examId: exam._id, sectionId: section1._id, type: 'mcq', order: 2, points: 2,
                questionText: 'Which data structure uses FIFO (First In, First Out) principle?',
                options: [
                    { label: 'A', text: 'Stack' },
                    { label: 'B', text: 'Queue' },
                    { label: 'C', text: 'Array' },
                    { label: 'D', text: 'Tree' }
                ],
                correctAnswer: 'B'
            },
            {
                examId: exam._id, sectionId: section1._id, type: 'mcq', order: 3, points: 2,
                questionText: 'What is the time complexity of binary search?',
                options: [
                    { label: 'A', text: 'O(n)' },
                    { label: 'B', text: 'O(n²)' },
                    { label: 'C', text: 'O(log n)' },
                    { label: 'D', text: 'O(1)' }
                ],
                correctAnswer: 'C'
            },
            {
                examId: exam._id, sectionId: section1._id, type: 'mcq', order: 4, points: 2,
                questionText: 'Which programming paradigm does Python primarily support?',
                options: [
                    { label: 'A', text: 'Only Object-Oriented' },
                    { label: 'B', text: 'Only Functional' },
                    { label: 'C', text: 'Only Procedural' },
                    { label: 'D', text: 'Multi-paradigm' }
                ],
                correctAnswer: 'D'
            }
        ]);

        // Section 2: True/False
        const section2 = await Section.create({ examId: exam._id, name: 'Part 2: True or False', order: 2 });
        exam.sections.push(section2._id);

        await Question.insertMany([
            {
                examId: exam._id, sectionId: section2._id, type: 'true-false', order: 1, points: 1,
                questionText: 'RAM is a type of permanent storage.',
                options: [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }],
                correctAnswer: 'B'
            },
            {
                examId: exam._id, sectionId: section2._id, type: 'true-false', order: 2, points: 1,
                questionText: 'An algorithm is a step-by-step procedure for solving a problem.',
                options: [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }],
                correctAnswer: 'A'
            },
            {
                examId: exam._id, sectionId: section2._id, type: 'true-false', order: 3, points: 1,
                questionText: 'HTTP stands for HyperText Transfer Protocol.',
                options: [{ label: 'A', text: 'True' }, { label: 'B', text: 'False' }],
                correctAnswer: 'A'
            }
        ]);

        // Section 3: Open-ended
        const section3 = await Section.create({ examId: exam._id, name: 'Part 3: Open-Ended', order: 3 });
        exam.sections.push(section3._id);

        await Question.insertMany([
            {
                examId: exam._id, sectionId: section3._id, type: 'open-ended', order: 1, points: 5,
                questionText: 'Explain the difference between a compiler and an interpreter.',
                correctAnswer: 'A compiler translates the entire source code into machine code before execution, producing an executable file. An interpreter translates and executes the code line by line at runtime without producing a separate executable file. Compilers generally produce faster-running programs, while interpreters offer more flexibility and easier debugging.'
            },
            {
                examId: exam._id, sectionId: section3._id, type: 'open-ended', order: 2, points: 5,
                questionText: 'What is object-oriented programming and what are its main principles?',
                correctAnswer: 'Object-oriented programming (OOP) is a programming paradigm based on the concept of objects, which contain data and code. The four main principles are: Encapsulation (bundling data and methods together), Inheritance (creating new classes from existing ones), Polymorphism (objects taking many forms), and Abstraction (hiding complex implementation details).'
            }
        ]);

        await exam.save();

        console.log('\\nSample exam created: "Introduction to Computer Science"');
        console.log('  - 4 MCQ questions (Part 1)');
        console.log('  - 3 True/False questions (Part 2)');
        console.log('  - 2 Open-ended questions (Part 3)');
        console.log('\\nExam codes: EXAM2024A, EXAM2024B, EXAM2024C');
        console.log('\\nSeed complete!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
}

seed();
