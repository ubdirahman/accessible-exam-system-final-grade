import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { downloadExcelTemplate, downloadWordTemplate } from '../utils/templateGenerator';

export default function ImportExamModal({ isOpen, onClose, onSuccess }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isSuper = user?.role === 'super_admin';
    const isTeacher = user?.role === 'teacher';

    const fileInputRef = useRef(null);

    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Associated Class & Subject selection
    const [faculties, setFaculties] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState(user?.facultyId || '');
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const loadClassesAndSubjects = async () => {
            try {
                if (isSuper) {
                    const facRes = await api.get('/faculties');
                    setFaculties(facRes.data);
                }

                if (isTeacher) {
                    const [classRes, subRes] = await Promise.all([
                        api.get('/classes/my'),
                        api.get('/subjects/my')
                    ]);
                    setClasses(classRes.data);
                    setSubjects(subRes.data);
                    if (classRes.data.length > 0 && !selectedClass) {
                        setSelectedClass(classRes.data[0]._id);
                    }
                } else {
                    const facultyId = isSuper ? selectedFaculty : user?.facultyId;
                    if (facultyId) {
                        const [classRes, subRes] = await Promise.all([
                            api.get('/classes', { params: { facultyId } }),
                            api.get('/subjects', { params: { facultyId } })
                        ]);
                        setClasses(classRes.data);
                        setSubjects(subRes.data);
                    }
                }
            } catch (err) {
                console.error('Error loading dropdown data:', err);
            }
        };

        loadClassesAndSubjects();
    }, [isOpen, isSuper, isTeacher, selectedFaculty, user?.facultyId]);

    if (!isOpen) return null;

    const resetModal = () => {
        setFile(null);
        setError(null);
        setSuccessMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        resetModal();
        onClose();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragging(true);
    };

    const handleDragLeave = () => setDragging(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
            setError(null);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    // Action 1: Parse file & open in ExamCreator for review/editing
    const handlePreviewInCreator = async () => {
        if (!file) {
            setError('Fadlan marka hore dooro file-ka examka.');
            return;
        }
        setParsing(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/exams/parse-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            handleClose();
            const targetPath = isTeacher ? '/teacher/create-exam' : '/admin/create-exam';
            navigate(targetPath, {
                state: {
                    importedExam: res.data,
                    initialClassId: selectedClass,
                    initialSubjectId: selectedSubject
                }
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Error parsing exam file.');
        } finally {
            setParsing(false);
        }
    };

    // Action 2: Direct Import into database
    const handleDirectImport = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Fadlan dooro file exam ah.');
            return;
        }
        if (!selectedClass) {
            setError('Fadlan dooro Fasalka (Class).');
            return;
        }
        if (!selectedSubject) {
            setError('Fadlan dooro Maaddada (Subject).');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('classId', selectedClass);
            formData.append('subjectId', selectedSubject);
            if (isSuper && selectedFaculty) formData.append('facultyId', selectedFaculty);

            const res = await api.post('/exams/import-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessMessage(`Exam "${res.data.exam?.title || ''}" was successfully imported with ${res.data.importedCount} questions!`);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            if (onSuccess) onSuccess();

            setTimeout(() => {
                handleClose();
            }, 1800);
        } catch (err) {
            setError(err.response?.data?.message || 'Error importing exam file.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                <div className="modal-header flex items-center justify-between">
                    <div>
                        <h2 style={{ fontWeight: 800, margin: 0 }} className="flex items-center gap-sm">
                            <i className="fa-solid fa-file-import text-primary"></i> Import Exam File
                        </h2>
                        <small className="text-muted">Import exam from Excel (.xlsx, .csv), Word (.docx, .doc), or PDF (.pdf)</small>
                    </div>
                    <button className="btn btn-ghost" onClick={handleClose}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '16px 20px' }}>
                    {error && (
                        <div className="badge badge-danger mb-md" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}>
                            <i className="fa-solid fa-circle-exclamation mr-xs"></i> {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="badge badge-success mb-md" style={{ width: '100%', padding: '10px 14px', borderRadius: 8 }}>
                            <i className="fa-solid fa-circle-check mr-xs"></i> {successMessage}
                        </div>
                    )}



                    {/* Dropzone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragging ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                            borderRadius: 12,
                            padding: '24px 16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: dragging ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-secondary)',
                            transition: 'all 0.2s ease',
                            marginBottom: 16
                        }}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv,.docx,.doc,.pdf"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <div style={{ fontSize: 36, marginBottom: 8, color: file ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                            <i className={file ? "fa-solid fa-file-circle-check" : "fa-solid fa-cloud-arrow-up"}></i>
                        </div>
                        {file ? (
                            <div>
                                <strong style={{ color: 'var(--accent-primary)' }}>{file.name}</strong>
                                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                                    {(file.size / 1024).toFixed(1)} KB • Click or drag another file to replace
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>
                                    Drag & drop exam file here, or <span className="text-primary">Browse</span>
                                </div>
                                <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                                    Supports Excel (.xlsx, .xls, .csv), Word (.docx, .doc), and PDF (.pdf)
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Associated Class & Subject Selection */}
                    <div className="grid-2 gap-md mb-md">
                        {isSuper && (
                            <div className="input-group" style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontWeight: 600, fontSize: 13 }}>Faculty</label>
                                <select
                                    className="input"
                                    value={selectedFaculty}
                                    onChange={(e) => setSelectedFaculty(e.target.value)}
                                    required
                                >
                                    <option value="">Select Faculty</option>
                                    {faculties.map((f) => (
                                        <option key={f._id} value={f._id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontWeight: 600, fontSize: 13 }}>Class (Fasalka) *</label>
                            <select
                                className="input"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map((c) => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontWeight: 600, fontSize: 13 }}>Subject (Maaddada) *</label>
                            <select
                                className="input"
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                required
                            >
                                <option value="">Select Subject *</option>
                                {subjects
                                    .filter((s) => !selectedClass || (s.classId?._id || s.classId) === selectedClass)
                                    .map((s) => (
                                        <option key={s._id} value={s._id}>{s.name}</option>
                                    ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="modal-footer flex items-center justify-between gap-sm" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleClose}>
                        Cancel
                    </button>

                    <div className="flex gap-sm">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handlePreviewInCreator}
                            disabled={!file || parsing || loading}
                            title="Parse file & open in editor to review questions"
                        >
                            {parsing ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Parsing...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-pen-to-square"></i> Preview & Edit
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleDirectImport}
                            disabled={!file || !selectedClass || !selectedSubject || loading || parsing}
                        >
                            {loading ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Importing...
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-cloud-arrow-up"></i> Import Direct
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
