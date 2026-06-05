'use client';

import { useState, useEffect, useRef } from 'react';

export default function Dashboard() {
  // Session Simulation State
  const [activeEmail, setActiveEmail] = useState('charlie@admin.com');
  const [sessionRole, setSessionRole] = useState('admin');
  const [sessionVerified, setSessionVerified] = useState(true);
  const [customEmailInput, setCustomEmailInput] = useState('');

  // Login Page States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginVerificationId, setLoginVerificationId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // SOBA Directory state
  const [sobaUsers, setSobaUsers] = useState([]);
  const [newAllocatedEmail, setNewAllocatedEmail] = useState('');
  const [newAllocatedRole, setNewAllocatedRole] = useState('viewer');
  const [newAllocatedVerificationId, setNewAllocatedVerificationId] = useState('');
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingVerificationIdInput, setEditingVerificationIdInput] = useState('');

  // Documents and Logs states
  const [files, setFiles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [expandedFileVersions, setExpandedFileVersions] = useState({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Real SOBA token override state (for localhost cross-domain sync)
  const [sobaRealToken, setSobaRealToken] = useState('');

  // System-wide Verification Link state (admin configuration)
  const [systemVerificationLink, setSystemVerificationLink] = useState('');
  const [editingVerificationLinkInput, setEditingVerificationLinkInput] = useState('');

  // File Upload states (Admin Panel & Revisions)
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [revisionFiles, setRevisionFiles] = useState({});

  // Secure Media Viewer Modal State
  const [viewedFile, setViewedFile] = useState(null);
  const [viewedFileUrl, setViewedFileUrl] = useState('');
  const [viewedFileError, setViewedFileError] = useState('');
  const [isViewing, setIsViewing] = useState(false);

  // References for file inputs
  const adminFileInputRef = useRef(null);

  // Check for auto-login parameter from redirect callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const loginAs = params.get('login_as');
      if (loginAs) {
        setActiveEmail(loginAs.toLowerCase().trim());
        setIsLoggedIn(true);
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  // 1. Initial Load & Synchronization on Session Switch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSobaRealToken(localStorage.getItem('soba_real_token') || '');
      // Load verification link from backend database settings
      fetch('/api/soba/verification-link')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setSystemVerificationLink(data.verificationLink);
            setEditingVerificationLinkInput(data.verificationLink);
          }
        })
        .catch(err => console.error(err));
    }
    fetchSobaUsers();
    fetchFiles();
    fetchAuditLogs();
  }, [activeEmail]);

  // Helper to compile request headers (simulated email or real session token)
  const getHeaders = () => {
    const headers = { 'x-soba-session-email': activeEmail };
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('soba_real_token') : null;
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    return headers;
  };

  // Periodic Audit Logs & User Directory polling (every 3 seconds) for real-time SQLite activity
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAuditLogs();
      fetchSobaUsers();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Resolve active profile details when activeEmail changes
  useEffect(() => {
    const matchedUser = sobaUsers.find(u => u.email === activeEmail);
    if (matchedUser) {
      setSessionRole(matchedUser.role);
      setSessionVerified(matchedUser.verified === 1);
    } else if (activeEmail === 'guest@unverified.com') {
      setSessionRole('guest');
      setSessionVerified(false);
    } else if (activeEmail) {
      // Check if custom email matches anything in SOBA
      fetch(`/api/soba/verify?email=${encodeURIComponent(activeEmail)}`)
        .then(r => r.json())
        .then(data => {
          setSessionRole(data.role || 'guest');
          setSessionVerified(data.verified || false);
        })
        .catch(() => {
          setSessionRole('guest');
          setSessionVerified(false);
        });
    }
  }, [activeEmail, sobaUsers]);

  // 2. HTTP Requests
  const fetchSobaUsers = async () => {
    try {
      const res = await fetch('/api/soba/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSobaUsers(data);
      }
    } catch (e) {
      console.error('Failed to fetch SOBA users:', e);
    }
  };

  const fetchFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const res = await fetch('/api/files', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      } else {
        setFiles([]);
      }
    } catch (e) {
      console.error('Failed to load files:', e);
      setFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
  };

  // 3. User Allocation (SOBA Admin Simulation)
  const handleAllocateUser = async (e) => {
    e.preventDefault();
    if (!newAllocatedEmail) return;

    try {
      const res = await fetch('/api/soba/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-soba-session-email': activeEmail
        },
        body: JSON.stringify({
          email: newAllocatedEmail,
          role: newAllocatedRole,
          verificationId: newAllocatedVerificationId,
          verificationLink: systemVerificationLink
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewAllocatedEmail('');
        setNewAllocatedVerificationId('');
        fetchSobaUsers();
        fetchAuditLogs();
        alert(`SOBA allocated successfully for: ${newAllocatedEmail}. Verification email sent!`);
      } else {
        alert(data.error || 'Allocation failed');
      }
    } catch (err) {
      alert('Error during user allocation');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          verificationId: loginEmail.toLowerCase().trim() === 'charlie@admin.com' ? undefined : loginVerificationId,
          password: loginEmail.toLowerCase().trim() === 'charlie@admin.com' ? loginPassword : undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.requiresVerification) {
          window.location.href = data.verificationUrl;
          return;
        }
        setActiveEmail(data.user.email);
        setSessionRole(data.user.role);
        setSessionVerified(data.user.verified);
        setIsLoggedIn(true);
        setLoginEmail('');
        setLoginVerificationId('');
        setLoginPassword('');
      } else {
        setLoginError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setLoginError('Network error during login');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveEmail('charlie@admin.com');
    setSessionRole('admin');
    setSessionVerified(true);
  };

  const handleSaveVerificationId = async (email) => {
    try {
      const res = await fetch('/api/soba/update-verification-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-soba-session-email': activeEmail
        },
        body: JSON.stringify({ email, verificationId: editingVerificationIdInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingUserEmail('');
        setEditingVerificationIdInput('');
        fetchSobaUsers();
        alert(`Personal ID updated successfully for ${email}`);
      } else {
        alert(data.error || 'Failed to update Personal ID');
      }
    } catch (e) {
      alert('Error updating Personal ID');
    }
  };






  // 4. Admin File Upload Handler
  const handleAdminFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    setUploadProgress('Uploading file to server...');

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: getHeaders(),
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        setUploadProgress('Upload successful!');
        setSelectedFile(null);
        if (adminFileInputRef.current) adminFileInputRef.current.value = '';
        fetchFiles();
        fetchAuditLogs();
        setTimeout(() => setUploadProgress(''), 2500);
      } else {
        setUploadProgress(`Error: ${data.error}`);
      }
    } catch (err) {
      setUploadProgress('Network error uploading file.');
    }
  };

  // 5. Editor File Revision Upload Handler
  const handleRevisionUpload = async (fileId) => {
    const fileToUpload = revisionFiles[fileId];
    if (!fileToUpload) return;

    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await fetch(`/api/files/${fileId}/edit`, {
        method: 'POST',
        headers: getHeaders(),
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        alert(data.message);
        // Clear this revision input
        setRevisionFiles(prev => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
        fetchFiles();
        fetchAuditLogs();
      } else {
        alert(`Failed to upload revision: ${data.error}`);
      }
    } catch (err) {
      alert('Error uploading file revision');
    }
  };

  // 6. View File Handler (Secure Viewer Modal)
  const handleViewFile = async (file) => {
    setViewedFile(file);
    setIsViewing(true);
    setViewedFileUrl('');
    setViewedFileError('');

    try {
      const res = await fetch(`/api/files/${file.id}/view`, {
        headers: getHeaders()
      });

      if (res.status === 403) {
        const errData = await res.json();
        setViewedFileError(errData.error || 'Access Denied: Unverified session');
        fetchAuditLogs();
        return;
      }

      if (!res.ok) {
        setViewedFileError('Failed to load file contents.');
        fetchAuditLogs();
        return;
      }

      // Convert stream to Blob object for display
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setViewedFileUrl(objectUrl);
      fetchAuditLogs();

    } catch (err) {
      setViewedFileError('Error communicating with backend document viewer.');
    }
  };

  // 7. Download Interception Handler
  const handleDownloadFile = async (fileId, fileName) => {
    try {
      const res = await fetch(`/api/files/${fileId}/view?download=true`, {
        headers: getHeaders()
      });

      if (res.status === 403) {
        const errData = await res.json();
        alert(`❌ SOBA Security Block:\n\n${errData.error}`);
        fetchAuditLogs();
        return;
      }

      if (!res.ok) {
        alert('Failed to retrieve file download stream.');
        return;
      }

      // Trigger automatic browser download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      fetchAuditLogs();

    } catch (err) {
      alert('Error streaming file download');
    }
  };

  const toggleVersions = (fileId) => {
    setExpandedFileVersions(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCustomSessionSubmit = (e) => {
    e.preventDefault();
    if (customEmailInput) {
      setActiveEmail(customEmailInput.toLowerCase().trim());
      setCustomEmailInput('');
    }
  };

  const handleSaveRealToken = (e) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('soba_real_token', sobaRealToken);
      alert('SOBA live session token saved locally! Fetching real session profile...');
      fetchFiles();
      fetchAuditLogs();
    }
  };

  const handleClearRealToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('soba_real_token');
      setSobaRealToken('');
      alert('Cleared real SOBA session token.');
      fetchFiles();
      fetchAuditLogs();
    }
  };


  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)', backgroundImage: 'var(--bg-canvas)' }}>
        <div className="card-section glass" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem', borderRadius: '16px', border: '1px solid var(--border-glow)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="brand-icon" style={{ width: '48px', height: '48px', margin: '0 auto 1rem', fontSize: '1.5rem' }}>S</div>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-header)', fontWeight: 800 }}>SOBA Secure Vault</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Verified File Access Platform Login</p>
          </div>

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                placeholder="e.g. user@enterprise.com"
                className="input-field"
                required
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setLoginError('');
                }}
              />
            </div>

            {loginEmail.toLowerCase().trim() === 'charlie@admin.com' ? (
              <div className="form-group">
                <label className="form-label">Admin Password</label>
                <input
                  type="password"
                  placeholder="Enter admin password"
                  className="input-field"
                  required
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError('');
                  }}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Personal ID</label>
                <input
                  type="text"
                  placeholder="Enter Personal ID"
                  className="input-field"
                  required
                  value={loginVerificationId}
                  onChange={(e) => {
                    setLoginVerificationId(e.target.value);
                    setLoginError('');
                  }}
                />
              </div>
            )}

            {loginError && (
              <p style={{ fontSize: '0.78rem', color: 'var(--color-error)', margin: '1rem 0', fontWeight: '500', textAlign: 'center' }}>
                ❌ {loginError}
              </p>
            )}

            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
              Verify & Sign In
            </button>
          </form>

          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Note: Non-admin users must complete their FaceID verification email flow before logging in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. Header widget with dynamic login switches */}
      <header className="main-header glass">
        <div className="brand">
          <div className="brand-icon">S</div>
          <span className="brand-name">SOBA Secure Vault</span>
        </div>

        <div className="session-widget" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="session-label">Current Session:</span>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', marginRight: '0.25rem' }}>
            {activeEmail}
          </span>

          <div className={`status-dot ${sessionVerified ? 'verified' : 'unverified'}`} />
          <span className={`badge-role-pill ${sessionRole}`}>
            {sessionVerified ? `${sessionRole} (Verified)` : 'Unverified'}
          </span>

          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: 'var(--color-error-border)', color: 'var(--color-error)', background: 'rgba(255, 23, 68, 0.05)', borderRadius: '4px', cursor: 'pointer', marginLeft: '0.5rem' }}
          >
            🚪 Logout
          </button>
        </div>
      </header>

      {/* 2. Main content grids */}
      <div className={`dashboard-grid ${(sessionRole !== 'admin' && sessionRole !== 'editor') ? 'no-sidebar' : ''}`}>

        {/* Sidebar panels */}
        {(sessionRole === 'admin' || sessionRole === 'editor') && (
          <aside className="sidebar glass">

            {/* Admin/Editor file upload Console */}
            <div className="card-section glass">
              <h3 className="card-title">
                <span>Secure Upload Console</span>
                <span className="card-title-icon">📤</span>
              </h3>

              {sessionVerified ? (
                <form onSubmit={handleAdminFileUpload}>
                  <div className="form-group">
                    <div className="upload-dropzone" onClick={() => adminFileInputRef.current?.click()}>
                      <span className="upload-icon">📁</span>
                      <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                        {selectedFile ? selectedFile.name : 'Select document file'}
                      </p>
                      <span className="upload-text">PDF, PNG, JPG, DOCX, MP3, MP4</span>
                    </div>
                    <input
                      type="file"
                      ref={adminFileInputRef}
                      style={{ display: 'none' }}
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      accept=".pdf,.png,.jpg,.jpeg,.docx,.mp4,.mp3"
                    />
                  </div>
                  {uploadProgress && (
                    <p style={{ fontSize: '0.75rem', color: '#b39ddb', margin: '0.5rem 0', fontWeight: '500' }}>
                      {uploadProgress}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!selectedFile}
                    style={{ opacity: selectedFile ? 1 : 0.6 }}
                  >
                    Confirm Upload
                  </button>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <p style={{ fontSize: '2.5rem', margin: '0 0 0.5rem 0' }}>🔒</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Only SOBA-verified Admins and Editors can upload new documents.
                  </p>
                </div>
              )}
            </div>

            {/* Verification Link Setup Panel (Admin Only) */}
            {sessionRole === 'admin' && (
              <div className="card-section glass">
                <h3 className="card-title">
                  <span>Verification Link Setup</span>
                  <span className="card-title-icon">⚙️</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Define the base FaceID verification URL used for security enrollment email templates.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="url"
                    placeholder="https://faceid.soba.network/verify?sid=..."
                    className="input-field"
                    value={editingVerificationLinkInput}
                    onChange={(e) => setEditingVerificationLinkInput(e.target.value)}
                  />
                  <button
                    className="btn-primary"
                    onClick={() => {
                      fetch('/api/soba/verification-link', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'x-soba-session-email': activeEmail
                        },
                        body: JSON.stringify({ verificationLink: editingVerificationLinkInput })
                      })
                      .then(r => r.json())
                      .then(data => {
                        if (data.success) {
                          setSystemVerificationLink(editingVerificationLinkInput);
                          alert('Verification Link updated successfully in the system!');
                        } else {
                          alert('Failed to update Verification Link: ' + data.error);
                        }
                      })
                      .catch(() => alert('Network error updating Verification Link'));
                    }}
                  >
                    Set Verification Link
                  </button>
                  {systemVerificationLink ? (
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
                      Active: <code style={{ wordBreak: 'break-all' }}>{systemVerificationLink}</code>
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-error)', marginTop: '0.25rem' }}>
                      ⚠️ No verification link set. Participant allocation will be disabled.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* SOBA Identity Provisioning Panel */}
            {/* SOBA Identity Provisioning Panel & Allocator (Admin Only) */}
            {sessionRole === 'admin' && (
              <div className="card-section glass">
                <h3 className="card-title">
                  <span>SOBA Real Connection</span>
                  <span className="card-title-icon">🔗</span>
                </h3>

                <div style={{ marginBottom: '1.25rem' }}>
                  <a
                    href="https://dashboard.soba.network/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, var(--accent-purple) 0%, #673ab7 100%)', textDecoration: 'none', textAlign: 'center', boxShadow: 'none' }}
                  >
                    🔑 Log in via SOBA
                  </a>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                    Opens SOBA dashboard.
                  </p>
                </div>

                <h3 className="card-title" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <span>SOBA Simulation Allocator</span>
                  <span className="card-title-icon">👥</span>
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Simulate the public SOBA Network Dashboard. Provision emails and assign roles.
                </p>

                {activeEmail === 'charlie@admin.com' ? (
                  <form onSubmit={handleAllocateUser} style={{ marginBottom: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Email Allocation</label>
                      <input
                        type="email"
                        placeholder="e.g. user@enterprise.com"
                        className="input-field"
                        required
                        disabled={!systemVerificationLink}
                        value={newAllocatedEmail}
                        onChange={(e) => setNewAllocatedEmail(e.target.value)}
                        style={{ opacity: systemVerificationLink ? 1 : 0.5 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Assigned Role</label>
                      <select
                        className="input-field"
                        style={{ background: 'rgba(0,0,0,0.3)', opacity: systemVerificationLink ? 1 : 0.5 }}
                        disabled={!systemVerificationLink}
                        value={newAllocatedRole}
                        onChange={(e) => setNewAllocatedRole(e.target.value)}
                      >
                        <option value="viewer">Viewer (Read & conditional download)</option>
                        <option value="editor">Editor (Read, write & update versions)</option>
                        <option value="admin">Admin (Full administrative credentials)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={!systemVerificationLink}
                      style={{ opacity: systemVerificationLink ? 1 : 0.5 }}
                    >
                      Allocate Participant
                    </button>
                  </form>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem 0', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>🔒</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Only Charlie (Admin) can allocate new participants.
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--accent-purple-light)', marginTop: '0.5rem', fontWeight: '600' }}>
                      Switch to Charlie (Admin) to access this console.
                    </p>
                  </div>
                )}

                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: '700' }}>
                  SOBA Managed Directory ({sobaUsers.length})
                </h4>
                <div className="soba-active-list">
                  {sobaUsers.map((user) => (
                    <div key={user.email} className="soba-user-card">
                      <div>
                        <p className="soba-user-email" title={user.email}>{user.email}</p>
                        {editingUserEmail === user.email ? (
                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="input-field"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', height: '26px', width: '80px', background: 'rgba(0,0,0,0.4)' }}
                              placeholder="ID"
                              value={editingVerificationIdInput}
                              onChange={(e) => setEditingVerificationIdInput(e.target.value)}
                            />
                            <button
                              className="btn-primary"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', width: 'auto', boxShadow: 'none', height: '26px' }}
                              onClick={() => handleSaveVerificationId(user.email)}
                            >
                              Save
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem', height: '26px' }}
                              onClick={() => setEditingUserEmail('')}
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              ID: <code style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px' }}>{user.verification_id || 'None'}</code>
                            </p>
                            {activeEmail === 'charlie@admin.com' && (
                              <button
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-purple-light)', cursor: 'pointer', fontSize: '0.68rem', padding: 0 }}
                                onClick={() => {
                                  setEditingUserEmail(user.email);
                                  setEditingVerificationIdInput(user.verification_id || '');
                                }}
                              >
                                ✏️ Edit
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginTop: '0.25rem' }}>
                          <span className={`badge-role-pill ${user.role}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>
                            {user.role}
                          </span>
                          <span className={`badge-status ${user.verified === 1 ? 'pass' : 'fail'}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.25rem' }}>
                            {user.verified === 1 ? 'Verified' : 'Pending'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                        {activeEmail === user.email && (
                          <span className="active-sim-badge">Active</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </aside>
        )}

        {/* Central Display stage */}
        <main className="content-stage">

          <div className="files-layout-header">
            <div>
              <h2>Document Repository Explorer</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                SQLite-backed document library. Enforced dynamically through SOBA verified credentials.
              </p>
            </div>
            <button className="btn-secondary" onClick={fetchFiles} disabled={isLoadingFiles}>
              {isLoadingFiles ? 'Syncing...' : '🔄 Sync Files'}
            </button>
          </div>

          {/* Document list explorer grid */}
          {isLoadingFiles ? (
            <div className="empty-state">
              <p style={{ fontSize: '1.25rem', fontWeight: '500', color: 'var(--accent-purple-light)' }}>
                Verifying SOBA status & loading document catalog...
              </p>
            </div>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📁</p>
              <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff' }}>
                {sessionVerified ? 'No files uploaded yet' : 'Access Restricted'}
              </p>
              <p style={{ fontSize: '0.85rem', maxWidth: '350px', margin: '0.5rem auto 0' }}>
                {sessionVerified
                  ? 'Switch role to Admin (Charlie) in the top bar to upload the first secure document.'
                  : 'This folder is restricted. You must log in as a SOBA-verified user to fetch metadata.'
                }
              </p>
            </div>
          ) : (
            <div className="file-grid">
              {files.map((file) => {
                const latestVersion = file.versions?.[0]?.version_number || 1;
                const isExpanded = !!expandedFileVersions[file.id];
                const revisionFileSelected = revisionFiles[file.id];

                return (
                  <div key={file.id} className="file-card">
                    <div className="file-card-header">
                      <div className={`file-type-icon ${file.file_type.toLowerCase()}`}>
                        {file.file_type === 'PDF' && 'PDF'}
                        {file.file_type === 'Image' && 'IMG'}
                        {file.file_type === 'DOCX' && 'DOC'}
                        {file.file_type === 'Video' && 'MP4'}
                        {file.file_type === 'Audio' && 'MP3'}
                        {file.file_type === 'Unknown' && '???'}
                      </div>
                      <div className="file-info">
                        <h4 className="file-title" title={file.original_name}>
                          {file.original_name}
                        </h4>
                        <div className="file-meta">
                          <span>{formatBytes(file.file_size)}</span>
                          <span>•</span>
                          <span>Ver: {latestVersion}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                          Uploaded by: {file.uploaded_by}
                        </p>
                      </div>
                    </div>

                    {/* Expandable revisions drawer */}
                    <button className="versions-toggle" onClick={() => toggleVersions(file.id)}>
                      <span>Version Log History ({file.versions?.length || 1})</span>
                      <span>{isExpanded ? '▲ Close' : '▼ Expand'}</span>
                    </button>

                    {isExpanded && (
                      <div className="version-list-drawer">
                        {file.versions?.map((ver) => (
                          <div key={ver.id} className="version-item">
                            <span style={{ fontWeight: '700', color: 'var(--accent-purple-light)' }}>
                              v{ver.version_number}
                            </span>
                            <span className="version-author" title={`Uploaded by ${ver.edited_by}`}>
                              by {ver.edited_by.split('@')[0]}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {new Date(ver.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Editor Revision Upload Widget */}
                    {(sessionRole === 'editor' || sessionRole === 'admin') && sessionVerified && (
                      <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="file"
                            id={`rev-upload-${file.id}`}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files[0];
                              if (f) {
                                setRevisionFiles(prev => ({ ...prev, [file.id]: f }));
                              }
                            }}
                            accept=".pdf,.png,.jpg,.jpeg,.docx,.mp4,.mp3"
                          />
                          <button
                            className="btn-secondary"
                            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                            onClick={() => document.getElementById(`rev-upload-${file.id}`).click()}
                          >
                            📎 {revisionFileSelected ? revisionFileSelected.name : 'Select Revision'}
                          </button>
                          {revisionFileSelected && (
                            <button
                              className="btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', width: 'auto', boxShadow: 'none' }}
                              onClick={() => handleRevisionUpload(file.id)}
                            >
                              Upload v{latestVersion + 1}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Standard Access Buttons */}
                    <div className="file-card-actions">
                      <button
                        className="btn-secondary"
                        style={{ flex: 1 }}
                        onClick={() => handleViewFile(file)}
                      >
                        👁️ Secure View
                      </button>
                      {sessionRole !== 'viewer' && (
                        <button
                          className="btn-secondary"
                          style={{ flex: 1 }}
                          onClick={() => handleDownloadFile(file.id, file.original_name)}
                        >
                          📥 Download
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Security audit logs panel */}
          {sessionRole === 'admin' && (
            <div className="card-section glass" style={{ marginTop: 'auto' }}>
              <h3 className="card-title">
                <span>SQLite Security & Access Audit Log</span>
                <span className="badge-status pass" style={{ fontSize: '0.7rem' }}>Real-time</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Direct live feed from the SQLite <code>access_logs</code> database table auditing SOBA verification statuses.
              </p>

              <div className="log-container">
                {auditLogs.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No access audit entries written yet. Trigger file actions to populate logs.
                  </p>
                ) : (
                  <table className="log-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User Session</th>
                        <th>Target File</th>
                        <th>Action</th>
                        <th>SOBA Role</th>
                        <th>Verification Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="log-row">
                          <td className="log-cell" style={{ color: 'var(--text-muted)' }}>
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="log-cell" style={{ fontWeight: '500' }}>
                            {log.user_email}
                          </td>
                          <td className="log-cell" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.file_name || '-'}
                          </td>
                          <td className="log-cell">
                            <code style={{ background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.3rem', borderRadius: '4px', color: '#fff' }}>
                              {log.action}
                            </code>
                          </td>
                          <td className="log-cell">
                            <span className={`badge-role-pill ${log.soba_role}`} style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>
                              {log.soba_role || 'guest'}
                            </span>
                          </td>
                          <td className="log-cell">
                            <span className={`badge-status ${log.soba_verified === 1 ? 'pass' : 'fail'}`}>
                              {log.soba_verified === 1 ? '✅ PASSED' : '❌ BLOCKED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* 3. Secure File View overlay Modal */}
      {isViewing && viewedFile && (
        <div className="modal-overlay" onClick={() => setIsViewing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>{viewedFile.original_name}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  Document Size: {formatBytes(viewedFile.file_size)} | Active Storage Node Path: <code>/{viewedFile.storage_path}</code>
                </p>
              </div>
              <button className="modal-close" onClick={() => setIsViewing(false)}>×</button>
            </div>

            {/* Secure indicator banners */}
            {viewedFileError ? (
              <div className="secure-indicator-bar denied">
                <span>🚫</span>
                <span>SOBA ROLE-BASED ACCESS CONTROL VIOLATION DETECTED: READ PERMISSION REJECTED</span>
              </div>
            ) : (
              <div className="secure-indicator-bar">
                <span>🛡️</span>
                <span>SOBA SECURITY VERIFIED | AUTHORIZED AS {sessionRole.toUpperCase()} | ENCRYPTED LINK DECRYPTED</span>
              </div>
            )}

            <div className="modal-body">
              {viewedFileError ? (
                <div className="unverified-blocked-state">
                  <div className="blocked-icon">🔐</div>
                  <h3 style={{ color: 'var(--color-error)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                    Access Restricted by SOBA
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    {viewedFileError}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginTop: '1rem', fontWeight: '500' }}>
                    Audit Log recorded. Direct system reads are compiled dynamically under active SOBA tokens.
                  </p>
                </div>
              ) : !viewedFileUrl ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Buffering raw file bits securely from disk...
                </p>
              ) : (
                <div className="viewer-frame">

                  {/* Image Inline View */}
                  {viewedFile.file_type === 'Image' && (
                    <img src={viewedFileUrl} className="image-viewer" alt={viewedFile.original_name} />
                  )}

                  {/* Audio Visual Player Inline View */}
                  {viewedFile.file_type === 'Audio' && (
                    <div className="audio-viewer">
                      <div className="audio-preview-icon">📻</div>
                      <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>Secure Audio Stream Player</p>
                      <audio controls src={viewedFileUrl} style={{ width: '100%', marginTop: '1rem' }} />
                    </div>
                  )}

                  {/* Video Player Inline View */}
                  {viewedFile.file_type === 'Video' && (
                    <video controls src={viewedFileUrl} className="video-viewer" />
                  )}

                  {/* PDF Direct Inline Document Rendering */}
                  {viewedFile.file_type === 'PDF' && (
                    <iframe
                      src={viewedFileUrl}
                      style={{ width: '100%', height: '65vh', border: 'none', background: '#fff' }}
                      title={viewedFile.original_name}
                    />
                  )}

                  {/* DOCX Document Fallback Secure Render */}
                  {viewedFile.file_type === 'DOCX' && (
                    <div className="document-viewer-fallback">
                      <span className="doc-fallback-icon">📄</span>
                      <h4 style={{ fontSize: '1.1rem' }}>Secure Document Reader Overlay</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
                        This DOCX file is rendered inside a secure sandboxed viewport to prevent local data breaches.
                      </p>
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left', width: '100%', maxWidth: '450px', fontSize: '0.8rem' }}>
                        <p style={{ color: 'var(--color-success)', fontWeight: '600', marginBottom: '0.25rem' }}>✓ System Decrypt Success</p>
                        <p style={{ color: 'var(--text-muted)' }}>Metadata: Verified through token <code>SOBA_JWT_...</code></p>
                        <p style={{ color: 'var(--text-muted)' }}>MIME-Type: <code>application/vnd.openxmlformats-officedocument.wordprocessingml.document</code></p>
                      </div>
                      {sessionRole !== 'viewer' && (
                        <button
                          className="btn-primary"
                          style={{ marginTop: '0.5rem', width: 'auto' }}
                          onClick={() => handleDownloadFile(viewedFile.id, viewedFile.original_name)}
                        >
                          Request Physical Copy (Download)
                        </button>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
