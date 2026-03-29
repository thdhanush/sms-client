import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Navigation,
  Loader2,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AttendanceTestModal from './AttendanceTestModal';
import { Filter, Search, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TeacherMarkStudentsAttendance = () => {
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [status, setStatus] = useState('Present');
  const [location, setLocation] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [distanceFromSchool, setDistanceFromSchool] = useState(null);
  const [showDebugModal, setShowDebugModal] = useState(false);

  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [standardFilter, setStandardFilter] = useState('');
  const [selectedStudents, setSelectedStudents] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [teacher, setTeacher] = useState(null);
  const [currentClass, setCurrentClass] = useState(''); // Initially empty
  const navigate = useNavigate();

  const apiUrl =
    import.meta.env.VITE_API_URL ||
    'https://result-portal-tkom.onrender.com/api';

  useEffect(() => {
    if (teacher?.classTeacher) {
      setCurrentClass(teacher.classTeacher); // auto-set the current class
    }
  }, [teacher]);

  // FETCH STUDENTS
  useEffect(() => {
    fetchStudents();
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'teacher') {
      toast.error('Please login first');
      navigate('/');
      return;
    }
    setTeacher(user);
  }, [navigate]);

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/student-management`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error(err);
    }
  };

  // FILTER LOGIC
  const filteredStudents = students
    .filter((s) => {
      const classTeacherFilter = teacher?.classTeacher
        ? s.standard === teacher.classTeacher
        : true;

      const searchFilter =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.grNumber.toLowerCase().includes(search.toLowerCase());

      const standardFilterCheck =
        !standardFilter || s.standard === standardFilter;

      return classTeacherFilter && searchFilter && standardFilterCheck;
    })
    .sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // SELECT FUNCTIONS
  const toggleSelectStudent = (id) => {
    setSelectedStudents((prev) => {
      const updated = { ...prev };
      if (updated[id]) delete updated[id];
      else updated[id] = 'Present';
      const records = Object.entries(updated).map(([id, status]) => ({
        studentId: id,
        status,
      }));
      saveDraftToBackend(records);
      return updated;
    });
  };

  const toggleSelectAll = () => {
    if (Object.keys(selectedStudents).length === filteredStudents.length) {
      setSelectedStudents({});
    } else {
      const allSelected = Object.fromEntries(
        filteredStudents.map((s) => [s._id, 'Present'])
      );
      setSelectedStudents(allSelected);
    }
  };

  // School location
  const SCHOOL_LOCATION = {
    latitude:
      parseFloat(import.meta.env.VITE_SCHOOL_LATITUDE) || 22.81713251852116,
    longitude:
      parseFloat(import.meta.env.VITE_SCHOOL_LONGITUDE) || 72.47335209589137,
    maxDistance:
      parseFloat(import.meta.env.VITE_SCHOOL_ATTENDANCE_RADIUS_KM) || 3,
  };

  // Check today's attendance & get location
  useEffect(() => {
    checkTodayStatus();
    getCurrentLocation();
  }, [currentClass]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const checkTodayStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token || !currentClass) return;
    try {
      const response = await fetch(
        `${apiUrl}/teacher-attendance/today?className=${encodeURIComponent(currentClass)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setTodayAttendance(data.attendance);
      }
    } catch (error) {
      console.error('Error checking today status:', error);
    }
  };

  const getCurrentLocation = () => {
    setLoadingLocation(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(newLocation);
        const distance = calculateDistance(
          newLocation.latitude,
          newLocation.longitude,
          SCHOOL_LOCATION.latitude,
          SCHOOL_LOCATION.longitude
        );
        setDistanceFromSchool(distance);
        setLoadingLocation(false);
        if (distance <= SCHOOL_LOCATION.maxDistance) {
          toast.success(
            `Location verified! You are ${distance.toFixed(2)}km from school.`
          );
        } else {
          toast.error(
            `You are ${distance.toFixed(2)}km from school. Must be within ${SCHOOL_LOCATION.maxDistance}km.`
          );
        }
      },
      (error) => {
        setLoadingLocation(false);
        let msg = 'Unable to get location: ';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg += 'Permission denied.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg += 'Position unavailable.';
            break;
          case error.TIMEOUT:
            msg += 'Timeout.';
            break;
          default:
            msg += 'Unknown error.';
        }
        setLocationError(msg);
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // 🔹 Update student status & save draft immediately
  const updateStudentStatus = (studentId, value) => {
    setSelectedStudents((prev) => {
      const updated = { ...prev };
      if (!value) delete updated[studentId];
      else updated[studentId] = value;

      const records = Object.entries(updated).map(([id, status]) => ({
        studentId: id,
        status,
      }));
      saveDraftToBackend(records);

      return updated;
    });
  };

  const saveDraftToBackend = async (records) => {
    if (!currentClass) return; // Must have a class selected
    try {
      const token = localStorage.getItem('token');
      await fetch(`${apiUrl}/student-attendance/draft`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ className: currentClass, records }),
      });
    } catch (err) {
      console.error('Failed to save draft:', err);
    }
  };

  const submitAttendanceFinal = async () => {
    if (!currentClass) {
      toast.error('Please select a class to submit');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/student-attendance/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ className: currentClass }),
      });
      const data = await res.json();
      if (res.ok) toast.success('Attendance submitted successfully');
      else toast.error(data.message);
    } catch (err) {
      console.error(err);
      toast.error('Submit failed');
    }
  };

  const getLocationStatusColor = () => {
    if (!location || distanceFromSchool === null) return 'text-gray-500';
    return distanceFromSchool <= SCHOOL_LOCATION.maxDistance
      ? 'text-green-600'
      : 'text-red-600';
  };

  const getLocationStatusIcon = () => {
    if (loadingLocation) return <Loader2 className="w-5 h-5 animate-spin" />;
    if (!location) return <MapPin className="w-5 h-5" />;
    return distanceFromSchool <= SCHOOL_LOCATION.maxDistance ? (
      <CheckCircle className="w-5 h-5" />
    ) : (
      <AlertTriangle className="w-5 h-5" />
    );
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(`2000-01-01 ${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  Teacher Attendance
                </h1>
                <p className="text-gray-600">
                  Mark students daily attendance with location verification
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setShowDebugModal(true)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Debug & Test Connection"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Class Filter */}
          {teacher?.classTeacher && (
            <div className="mb-4">
              <select
                value={currentClass}
                onChange={(e) => setCurrentClass(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Class</option>
                <option value={teacher.classTeacher}>
                  {teacher.classTeacher}
                </option>
              </select>
            </div>
          )}

          {/* Today's Status */}
          {todayAttendance && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800">
                    Attendance Already Marked
                  </h3>
                  <p className="text-green-600">
                    Status: {todayAttendance.status} • Time:{' '}
                    {formatTime(todayAttendance.checkInTime)}
                  </p>
                  {todayAttendance.location && (
                    <p className="text-green-600 text-sm">
                      Location: {todayAttendance.location.address}
                    </p>
                  )}
                  {todayAttendance.remarks && (
                    <p className="text-green-600 text-sm">
                      Remarks: {todayAttendance.remarks}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!todayAttendance && (
            <>
              {/* Location Status Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Location Verification
                  </h3>
                  <button
                    onClick={getCurrentLocation}
                    disabled={loadingLocation}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                    {loadingLocation ? 'Getting Location...' : 'Get Location'}
                  </button>
                </div>

                <div
                  className={`flex items-center gap-2 ${getLocationStatusColor()}`}
                >
                  {getLocationStatusIcon()}
                  <span className="font-medium">
                    {loadingLocation && 'Getting your location...'}
                    {!loadingLocation && !location && 'Location not detected'}
                    {!loadingLocation && locationError && locationError}
                    {location && distanceFromSchool !== null && (
                      <>
                        Distance from school: {distanceFromSchool.toFixed(2)}km
                        {distanceFromSchool <= SCHOOL_LOCATION.maxDistance
                          ? ' (Within allowed range)'
                          : ` (Must be within ${SCHOOL_LOCATION.maxDistance}km)`}
                      </>
                    )}
                  </span>
                </div>

                {location && (
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Latitude: </span>
                      {location.latitude.toFixed(6)}
                    </div>
                    <div>
                      <span className="font-medium">Longitude: </span>
                      {location.longitude.toFixed(6)}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Accuracy: </span>
                      {location.accuracy
                        ? `±${location.accuracy.toFixed(0)}m`
                        : 'N/A'}
                    </div>
                  </div>
                )}
              </div>
              {/* Attendance Form */}
              {/* 🔍 FILTER SECTION */}
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Search & Filters
                  </h3>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showFilters ? 'Hide' : 'Show'} Advanced Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search Box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by name, GR number, or email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Class Teacher Filter (only if teacher is classTeacher) */}
                  {teacher?.classTeacher && (
                    <select
                      value={standardFilter}
                      onChange={(e) => setStandardFilter(e.target.value)}
                      className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value={teacher.classTeacher}>
                        {teacher.classTeacher}
                      </option>
                    </select>
                  )}

                  {/* Advanced Filters */}
                  {showFilters && (
                    <>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="name">Sort by Name</option>
                        <option value="grNumber">Sort by GR Number</option>
                        <option value="standard">Sort by Standard</option>
                        <option value="createdAt">
                          Sort by Registration Date
                        </option>
                      </select>

                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </select>
                    </>
                  )}
                </div>

                {/* Active Filters */}
                {(search || standardFilter) && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600">
                      Active filters:
                    </span>
                    {search && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1">
                        Search: {search}
                        <button
                          onClick={() => setSearch('')}
                          className="hover:text-blue-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {standardFilter && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1">
                        Class: {standardFilter}
                        <button
                          onClick={() => setStandardFilter('')}
                          className="hover:text-blue-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 📋 STUDENT GRID */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStudents.length === 0 && (
                  <p className="col-span-full text-center text-gray-500">
                    No students found
                  </p>
                )}

                {filteredStudents.map((student) => {
                  const status = selectedStudents[student._id] || '';

                  // Dynamic background based on status
                  let bgClass = 'bg-white';
                  if (status === 'Present') bgClass = 'bg-green-100';
                  else if (status === 'Absent') bgClass = 'bg-red-100';
                  else if (status === 'Half-Day') bgClass = 'bg-yellow-100';

                  return (
                    <div
                      key={student._id}
                      className={`${bgClass} border rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-200 relative flex flex-col justify-between`}
                    >
                      {/* Reset Button */}
                      {status && (
                        <button
                          onClick={() =>
                            updateStudentStatus(student._id, undefined)
                          }
                          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                          title="Reset Status"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      {/* Student Info */}
                      <div className="mb-3">
                        <p className="font-medium text-gray-800">
                          {student.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {student.grNumber} • {student.standard}
                        </p>
                      </div>

                      {/* Attendance Buttons */}
                      <div className="flex justify-between gap-2 mt-auto">
                        <button
                          type="button"
                          onClick={() =>
                            updateStudentStatus(student._id, 'Present')
                          }
                          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                            status === 'Present'
                              ? 'bg-green-600 text-white'
                              : 'bg-green-200 text-green-800 hover:bg-green-300'
                          }`}
                        >
                          Present
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateStudentStatus(student._id, 'Absent')
                          }
                          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                            status === 'Absent'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-200 text-red-800 hover:bg-red-300'
                          }`}
                        >
                          Absent
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateStudentStatus(student._id, 'Half-Day')
                          }
                          className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                            status === 'Half-Day'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                          }`}
                        >
                          Half-Day
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* School Information */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              School Location Info
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Latitude: </span>
                {SCHOOL_LOCATION.latitude}
              </div>
              <div>
                <span className="font-medium">Longitude: </span>
                {SCHOOL_LOCATION.longitude}
              </div>
              <div>
                <span className="font-medium">Allowed Radius: </span>
                {SCHOOL_LOCATION.maxDistance}km
              </div>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              How to Mark Attendance
            </h3>
            <ul className="space-y-2 text-blue-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-800">1.</span>
                Allow location access when prompted by your browser
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-800">2.</span>
                Make sure you are within 3km of the school location
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-800">3.</span>
                Select your attendance status (Present, Absent, Half-Day, or
                Leave)
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-800">4.</span>
                Add remarks if needed and click "Mark Attendance"
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-800">Note:</span>
                Location verification is not required for "Leave" status
              </li>
            </ul>
          </div>

          {/* Requirements Checklist */}
          <div className="mt-6 bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Requirements Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">
                  Attendance Status Selected
                </span>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Location Verification</span>
                {status === 'Leave' ? (
                  <div className="flex items-center gap-1 text-blue-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">Not Required</span>
                  </div>
                ) : location &&
                  distanceFromSchool <= SCHOOL_LOCATION.maxDistance ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
              </div>
            </div>
          </div>
        </div>
        <AttendanceTestModal
          isOpen={showDebugModal}
          onClose={() => setShowDebugModal(false)}
        />
      </div>
    </div>
  );
};

export default TeacherMarkStudentsAttendance;
