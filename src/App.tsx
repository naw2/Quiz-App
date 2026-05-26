/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  googleProvider, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Trophy, 
  Code2, 
  Timer,
  Zap,
  Brain,
  Rocket,
  ChevronLeft,
  Star,
  Flame,
  TrendingUp,
  Award,
  LogOut,
  History,
  User as UserIcon,
  Loader2,
  Search,
  Users,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { pythonQuestions, Question, Difficulty } from './data/questions';

const TIMER_SECONDS = 20;
const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  maxStreak: number;
  createdAt: any;
}

interface QuizAttempt {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  xpGained: number;
  completedAt: any;
}

export default function App() {
  // Auth & Profile State
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);

  // Teacher / Admin Panel State
  const [viewMode, setViewMode] = useState<'student' | 'teacher'>('student');
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [allAttempts, setAllAttempts] = useState<QuizAttempt[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminTab, setAdminTab] = useState<'students' | 'attempts'>('students');

  // Game & Quiz State
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [streak, setStreak] = useState(0);
  const [maxStreakSession, setMaxStreakSession] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [lastXpGained, setLastXpGained] = useState(0);
  const [xpEarnedThisQuiz, setXpEarnedThisQuiz] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const filteredQuestions = difficulty 
    ? pythonQuestions.filter(q => q.difficulty === difficulty)
    : [];

  const currentQuestion = filteredQuestions[currentQuestionIndex];

  // Listen to Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchOrCreateProfile(currentUser);
      } else {
        setProfile(null);
        setAttempts([]);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Timer logic
  useEffect(() => {
    if (isTimerActive && timeLeft > 0 && !isAnswered) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && !isAnswered) {
      handleTimeUp();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isTimerActive, isAnswered]);

  const fetchOrCreateProfile = async (currentUser: User) => {
    setDbLoading(true);
    const docRef = doc(db, 'students', currentUser.uid);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as StudentProfile);
      } else {
        // Create new user profile
        const newProfile: StudentProfile = {
          id: currentUser.uid,
          name: currentUser.displayName || 'Pythonist-in-Training',
          email: currentUser.email || '',
          xp: 0,
          level: 1,
          maxStreak: 0,
          createdAt: serverTimestamp()
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
      await fetchUserAttempts(currentUser.uid);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `students/${currentUser.uid}`);
    } finally {
      setDbLoading(false);
      setAuthLoading(false);
    }
  };

  const fetchUserAttempts = async (studentId: string) => {
    try {
      const q = query(
        collection(db, 'quiz_attempts'),
        where('studentId', '==', studentId),
        orderBy('completedAt', 'desc'),
        limit(5)
      );
      const querySnap = await getDocs(q);
      const attemptsList: QuizAttempt[] = [];
      querySnap.forEach((doc) => {
        attemptsList.push(doc.data() as QuizAttempt);
      });
      setAttempts(attemptsList);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'quiz_attempts');
    }
  };

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      // 1. Fetch all students
      const studentsQuerySnap = await getDocs(collection(db, 'students'));
      const studentsList: StudentProfile[] = [];
      studentsQuerySnap.forEach((doc) => {
        studentsList.push(doc.data() as StudentProfile);
      });
      // Sort by XP
      studentsList.sort((a, b) => (b.xp || 0) - (a.xp || 0));
      setAllStudents(studentsList);

      // 2. Fetch all quiz attempts
      const attemptsQuerySnap = await getDocs(collection(db, 'quiz_attempts'));
      const attemptsList: QuizAttempt[] = [];
      attemptsQuerySnap.forEach((doc) => {
        attemptsList.push(doc.data() as QuizAttempt);
      });
      // Sort by date descending
      attemptsList.sort((a, b) => {
        const timeA = a.completedAt?.toDate ? a.completedAt.toDate().getTime() : (a.completedAt ? new Date(a.completedAt).getTime() : 0);
        const timeB = b.completedAt?.toDate ? b.completedAt.toDate().getTime() : (b.completedAt ? new Date(b.completedAt).getTime() : 0);
        return timeB - timeA;
      });
      setAllAttempts(attemptsList);
    } catch (err) {
      console.error("Error loading admin lists:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setDifficulty(null);
      setShowResult(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleTimeUp = () => {
    setIsAnswered(true);
    setSelectedOption(-1);
    setStreak(0);
  };

  const startQuiz = (diff: Difficulty) => {
    setDifficulty(diff);
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsAnswered(false);
    setSelectedOption(null);
    setTimeLeft(TIMER_SECONDS);
    setIsTimerActive(true);
    setShowResult(false);
    setStreak(0);
    setMaxStreakSession(0);
    setXpEarnedThisQuiz(0);
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const triggerCelebration = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#3b82f6', '#f59e0b']
    });
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
    setIsTimerActive(false);
    
    if (selectedOption === currentQuestion.correctAnswer) {
      const streakBonus = streak * 2;
      const totalGained = XP_PER_CORRECT + streakBonus;
      
      setScore(prev => prev + 1);
      setXpEarnedThisQuiz(prev => prev + totalGained);
      setLastXpGained(totalGained);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > maxStreakSession) setMaxStreakSession(newStreak);
        return newStreak;
      });
      triggerCelebration();
    } else {
      setStreak(0);
      setLastXpGained(0);
    }
  };

  const handleFinishQuiz = async () => {
    if (!profile || !user) return;
    
    setDbLoading(true);
    const updatedXp = profile.xp + xpEarnedThisQuiz;
    const updatedLevel = Math.floor(updatedXp / XP_PER_LEVEL) + 1;
    const updatedMaxStreak = Math.max(profile.maxStreak, maxStreakSession);

    // Save attempts log
    const attemptId = `attempt_${Date.now()}_${user.uid.slice(0, 5)}`;
    const newAttempt: QuizAttempt = {
      id: attemptId,
      studentId: user.uid,
      studentName: profile.name,
      studentEmail: profile.email,
      difficulty: difficulty || 'Beginner',
      score: score,
      totalQuestions: filteredQuestions.length,
      xpGained: xpEarnedThisQuiz,
      completedAt: new Date().toISOString() // We use ISO layout client-side for consistent displaying log, matched via validation schema
    };

    try {
      // Create quiz attempt
      await setDoc(doc(db, 'quiz_attempts', attemptId), {
        ...newAttempt,
        completedAt: serverTimestamp()
      });

      // Update student profile
      await updateDoc(doc(db, 'students', user.uid), {
        xp: updatedXp,
        level: updatedLevel,
        maxStreak: updatedMaxStreak
      });

      // Sync local profile state
      setProfile(prev => prev ? {
        ...prev,
        xp: updatedXp,
        level: updatedLevel,
        maxStreak: updatedMaxStreak
      } : null);

      await fetchUserAttempts(user.uid);
      setShowResult(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `quiz_attempts/${attemptId}`);
    } finally {
      setDbLoading(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex + 1 < filteredQuestions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setTimeLeft(TIMER_SECONDS);
      setIsTimerActive(true);
    } else {
      handleFinishQuiz();
    }
  };

  const resetQuiz = () => {
    setDifficulty(null);
    setShowResult(false);
  };

  // LOADING SCREEN
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center font-sans p-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-indigo-600 mb-4"
        >
          <Loader2 size={40} />
        </motion.div>
        <p className="text-slate-500 font-bold">Warming up Python interpreter...</p>
      </div>
    );
  }

  // SIGN IN / REGISTRATION SCREEN
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl border-2 border-slate-200 p-8 text-center shadow-[0_8px_0_0_#e2e8f0]"
        >
          <div className="w-20 h-20 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_6px_0_0_#4338ca]">
            <Code2 size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">Python Scholar</h1>
          <p className="text-slate-500 font-bold mb-8">Register/Sign in to keep track of your scores, streaks, and level up!</p>

          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white hover:bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-700 font-black flex items-center justify-center gap-3 transition-all active:translate-y-1 active:shadow-none shadow-[0_4px_0_0_#cbd5e1]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.56 14.94 1 12 1 7.24 1 3.2 3.76 1.28 7.78l3.75 2.9C6.01 7.24 8.79 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.52 12.3c0-.82-.07-1.6-.22-2.3H12v4.4h6.5c-.28 1.44-1.1 2.66-2.3 3.42l3.6 2.8c2.1-1.94 3.32-4.8 3.32-8.32z" />
              <path fill="#FBBC05" d="M5.03 14.68A7.21 7.21 0 0 1 4.6 12c0-.93.16-1.83.43-2.68L1.28 6.42A11.96 11.96 0 0 0 0 12c0 2.05.52 4 1.44 5.72l3.59-3.04z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.6-2.8c-1.1.74-2.52 1.18-4.36 1.18-3.21 0-5.99-2.2-6.96-5.18L1.29 16.32C3.21 20.24 7.24 23 12 23z" />
            </svg>
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const currentLevel = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = profile.xp % XP_PER_LEVEL;

  // DIFFICULTY SELECTION SCREEN
  if (!difficulty) {
    const isCurrentUserTeacher = user?.email === 'nawnaw1986@gmail.com' || profile?.email === 'nawnaw1986@gmail.com';

    return (
      <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-start p-6 font-sans">
        {/* Top bar with stats, view toggle, & signout */}
        <div className="max-w-2xl w-full flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b-2 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold overflow-hidden border-2 border-white shadow-md">
              {user.photoURL ? <img src={user.photoURL} alt="User photo" referrerPolicy="no-referrer" /> : <UserIcon size={20} />}
            </div>
            <div>
              <p className="text-sm font-black text-slate-700 leading-none">{profile.name}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                {isCurrentUserTeacher ? 'Course Teacher' : 'Student Scholar'}
              </p>
            </div>
          </div>

          {/* Teacher / Student Toggle */}
          {isCurrentUserTeacher && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex bg-slate-200 p-1 rounded-xl border border-slate-300">
                <button
                  onClick={() => setViewMode('student')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    viewMode === 'student'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Student View
                </button>
                <button
                  onClick={() => {
                    setViewMode('teacher');
                    fetchAdminData();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    viewMode === 'teacher'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  Teacher View
                </button>
              </div>
              <span className="text-[9px] font-bold text-indigo-500 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-150">
                🔒 Admin level access active for {user.email}
              </span>
            </div>
          )}

          <button 
            onClick={handleLogout}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

        {viewMode === 'teacher' && isCurrentUserTeacher ? (
          /* TEACHER ADMIN PANEL VIEW */
          <div className="max-w-2xl w-full flex-1 flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <span>👩‍🏫 Teacher Dashboard</span>
              </h1>
              <button 
                onClick={fetchAdminData}
                disabled={adminLoading}
                className="text-xs px-3 py-1.5 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-black rounded-xl transition shadow-sm active:translate-y-0.5"
              >
                {adminLoading ? 'Refreshing...' : 'Refresh Records'}
              </button>
            </div>

            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center text-center shadow-[0_4px_0_0_#e2e8f0]">
                <Users className="text-indigo-500 mb-1" size={20} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Students</p>
                <p className="text-lg font-black text-slate-800">{allStudents.length}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center text-center shadow-[0_4px_0_0_#e2e8f0]">
                <Trophy className="text-yellow-500 mb-1" size={20} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Quiz Attempts</p>
                <p className="text-lg font-black text-slate-800">{allAttempts.length}</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center text-center shadow-[0_4px_0_0_#e2e8f0]">
                <CheckCircle2 className="text-emerald-500 mb-1" size={20} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Avg. Score</p>
                <p className="text-lg font-black text-slate-800">
                  {allAttempts.length > 0 
                    ? `${(allAttempts.reduce((acc, a) => acc + (a.score / a.totalQuestions), 0) / allAttempts.length * 100).toFixed(0)}%`
                    : 'N/A'
                  }
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center text-center shadow-[0_4px_0_0_#e2e8f0]">
                <Star className="text-amber-500 mb-1" size={20} />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Class Total XP</p>
                <p className="text-lg font-black text-slate-800 font-extrabold">
                  {allStudents.reduce((acc, s) => acc + (s.xp || 0), 0)}
                </p>
              </div>
            </div>

            {/* Drilldown details section if clicking specific student */}
            {selectedStudentId && (
              <div className="bg-amber-50 border-2 border-amber-200 p-5 rounded-2xl mb-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-amber-250">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-amber-700" />
                    <h3 className="text-sm font-black text-amber-800">
                      Attempts for {allStudents.find(s => s.id === selectedStudentId)?.name || 'Student'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedStudentId(null)}
                    className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-1 rounded-lg font-black transition-colors"
                  >
                    Clear Filter
                  </button>
                </div>
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {allAttempts.filter(a => a.studentId === selectedStudentId).length === 0 ? (
                    <p className="text-xs font-bold text-amber-600 text-center py-2">No attempts recorded for this student.</p>
                  ) : (
                    allAttempts.filter(a => a.studentId === selectedStudentId).map(att => (
                      <div key={att.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                        <div>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider mb-1 ${
                            att.difficulty === 'Beginner' ? 'bg-yellow-100 text-yellow-700' :
                            att.difficulty === 'Intermediate' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {att.difficulty}
                          </span>
                          <p className="text-xs text-slate-600 font-bold">
                            Score: <span className="font-black text-slate-800">{att.score}/{att.totalQuestions}</span>
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-xs font-black text-emerald-600">+{att.xpGained} XP</span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {att.completedAt?.toDate 
                              ? att.completedAt.toDate().toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) 
                              : (att.completedAt ? new Date(att.completedAt).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}) : '')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Main Tabs */}
            <div className="flex border-b-2 border-slate-200 mb-4 bg-white rounded-t-xl">
              <button
                onClick={() => setAdminTab('students')}
                className={`py-3 px-4 font-black text-sm border-b-2 -mb-[2px] transition-all flex items-center gap-2 ${
                  adminTab === 'students'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Users size={16} />
                Class List ({allStudents.length})
              </button>
              <button
                onClick={() => setAdminTab('attempts')}
                className={`py-3 px-4 font-black text-sm border-b-2 -mb-[2px] transition-all flex items-center gap-2 ${
                  adminTab === 'attempts'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <History size={16} />
                Attempts History Feed ({allAttempts.length})
              </button>
            </div>

            {/* Filter Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                placeholder="Search by student name or email..."
                className="w-full pl-9 pr-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Tab Contents */}
            {adminLoading ? (
              <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border-2 border-slate-200 p-6 text-center">
                <Loader2 className="text-indigo-600 animate-spin mb-2" size={24} />
                <p className="text-xs font-bold text-slate-500">Querying live Firestore databases...</p>
              </div>
            ) : adminTab === 'students' ? (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {allStudents
                  .filter(s => s.name?.toLowerCase().includes(adminSearchQuery.toLowerCase()) || s.email?.toLowerCase().includes(adminSearchQuery.toLowerCase()))
                  .length === 0 ? (
                    <p className="text-center text-slate-400 text-sm font-bold py-12 bg-white rounded-2xl border-2 border-slate-200">No matching students found.</p>
                  ) : (
                    allStudents
                      .filter(s => s.name?.toLowerCase().includes(adminSearchQuery.toLowerCase()) || s.email?.toLowerCase().includes(adminSearchQuery.toLowerCase()))
                      .map((student, idx) => (
                        <div 
                          key={student.id} 
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`flex items-center justify-between p-3.5 bg-white border-2 hover:border-indigo-300 rounded-2xl cursor-pointer transition-all shadow-sm ${
                            selectedStudentId === student.id ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-700 text-sm border-2 border-slate-200">
                              {student.name ? student.name[0].toUpperCase() : 'P'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 leading-none">
                                <span className="text-xs font-black text-indigo-500">#{idx + 1}</span>
                                <h4 className="text-sm font-black text-slate-800">{student.name}</h4>
                              </div>
                              <p className="text-[11px] font-bold text-slate-400 mt-1">{student.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Level {student.level || 1}</span>
                              <p className="text-sm font-black text-indigo-600">{student.xp || 0} XP</p>
                            </div>
                            <ChevronRight className="text-slate-300" size={16} />
                          </div>
                        </div>
                      ))
                  )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {allAttempts
                  .filter(a => a.studentName?.toLowerCase().includes(adminSearchQuery.toLowerCase()) || a.studentEmail?.toLowerCase().includes(adminSearchQuery.toLowerCase()))
                  .length === 0 ? (
                    <p className="text-center text-slate-400 text-sm font-bold py-12 bg-white rounded-2xl border-2 border-slate-200">No matching attempts found.</p>
                  ) : (
                    allAttempts
                      .filter(a => a.studentName?.toLowerCase().includes(adminSearchQuery.toLowerCase()) || a.studentEmail?.toLowerCase().includes(adminSearchQuery.toLowerCase()))
                      .map((att) => (
                        <div key={att.id} className="p-3 bg-white border-2 border-slate-200 rounded-2xl flex justify-between items-center shadow-sm">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                att.difficulty === 'Beginner' ? 'bg-yellow-105 text-yellow-700 bg-yellow-50' :
                                att.difficulty === 'Intermediate' ? 'bg-blue-105 text-blue-700 bg-blue-50' : 'bg-purple-105 text-purple-700 bg-purple-50'
                              }`}>
                                {att.difficulty}
                              </span>
                              <span className="text-slate-700 font-extrabold text-xs">{att.studentName}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-bold">{att.studentEmail}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-800">Score: {att.score}/{att.totalQuestions}</p>
                            <p className="text-[11px] font-black text-emerald-600">+{att.xpGained} XP</p>
                          </div>
                        </div>
                      ))
                  )}
              </div>
            )}
          </div>
        ) : (
          /* STANDARD STUDENT VIEW SCREEN */
          <>
            {/* Global Dashboard Stats */}
            <div className="max-w-md w-full mb-8 grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center shadow-[0_4px_0_0_#e2e8f0]">
                <Star size={18} fill="currentColor" className="text-indigo-500 mb-1" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Level</p>
                <p className="text-sm font-black text-slate-800">{currentLevel}</p>
              </div>
              <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center shadow-[0_4px_0_0_#e2e8f0]">
                <Flame size={18} fill="currentColor" className="text-orange-500 mb-1" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Max Streak</p>
                <p className="text-sm font-black text-slate-800">{profile.maxStreak}</p>
              </div>
              <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center shadow-[0_4px_0_0_#e2e8f0]">
                <Award size={18} fill="currentColor" className="text-emerald-500 mb-1" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none font-medium">XP Earned</p>
                <p className="text-sm font-black text-slate-800">{profile.xp}</p>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full text-center mb-8"
            >
              <h2 className="text-2xl font-black text-slate-800 mb-1">Pick a Quiz Path</h2>
              <p className="text-slate-500 text-sm font-bold mb-6">Select a category to test your coding skills</p>

              <div className="space-y-4">
                {[
                  { id: 'Beginner', icon: <Zap className="text-yellow-500" />, color: 'border-yellow-400 text-yellow-700 bg-yellow-50 shadow-[0_6px_0_0_#facc15]' },
                  { id: 'Intermediate', icon: <Brain className="text-blue-500" />, color: 'border-blue-400 text-blue-700 bg-blue-50 shadow-[0_6px_0_0_#60a5fa]' },
                  { id: 'Advanced', icon: <Rocket className="text-purple-500" />, color: 'border-purple-400 text-purple-700 bg-purple-50 shadow-[0_6px_0_0_#a78bfa]' }
                ].map((level) => (
                  <button
                    key={level.id}
                    disabled={dbLoading}
                    onClick={() => startQuiz(level.id as Difficulty)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all active:translate-y-1 active:shadow-none ${level.color}`}
                  >
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      {level.icon}
                    </div>
                    <div className="string text-left">
                      <h3 className="text-base font-black">{level.id}</h3>
                      <p className="text-[11px] opacity-70 font-bold">Earn XP & Badges</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Dynamic Historic Logs / Scoreboard section from Firestore */}
            {attempts.length > 0 && (
              <div className="max-w-md w-full bg-white rounded-2xl border-2 border-slate-200 p-5 mt-auto shadow-[0_4px_0_0_#e2e8f0]">
                <div className="flex items-center gap-2 mb-4 text-slate-600 border-b pb-2">
                  <History size={16} />
                  <h4 className="text-sm font-black uppercase tracking-wider">Your Recent Attempts</h4>
                </div>
                <div className="space-y-3">
                  {attempts.map((att) => (
                    <div key={att.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-1 ${
                          att.difficulty === 'Beginner' ? 'bg-yellow-101 text-yellow-700' :
                          att.difficulty === 'Intermediate' ? 'bg-blue-101 text-blue-700' : 'bg-purple-101 text-purple-700'
                        }`}>
                          {att.difficulty}
                        </span>
                        <p className="text-xs text-slate-400 font-bold">Score: {att.score}/{att.totalQuestions}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs font-black text-indigo-600 font-extrabold text-indigo-650">+{att.xpGained} XP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // RESULT SCREEN
  if (showResult) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="relative inline-block mb-8">
            <Trophy className="w-32 h-32 text-yellow-400 drop-shadow-lg" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-4 border-dashed border-yellow-200 rounded-full -m-4"
            />
          </div>
          <h2 className="text-4xl font-black text-slate-800 mb-2">Quiz Finished!</h2>
          <p className="text-slate-500 font-bold mb-8">You finished the {difficulty} level.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-12">
            <div className="bg-indigo-50 border-2 border-indigo-200 p-6 rounded-3xl shadow-[0_6px_0_0_#c7d2fe]">
              <p className="text-indigo-400 font-black uppercase text-xs tracking-widest mb-1">XP Earned</p>
              <p className="text-3xl font-black text-indigo-700">+{xpEarnedThisQuiz}</p>
            </div>
            <div className="bg-orange-50 border-2 border-orange-200 p-6 rounded-3xl shadow-[0_6px_0_0_#fed7aa]">
              <p className="text-orange-400 font-black uppercase text-xs tracking-widest mb-1">Session Streak</p>
              <div className="flex items-center justify-center gap-2">
                <Flame size={24} className="text-orange-500" fill="currentColor" />
                <p className="text-3xl font-black text-orange-700">{maxStreakSession}</p>
              </div>
            </div>
          </div>

          <button
            onClick={resetQuiz}
            className="w-full py-5 bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-[0_6px_0_0_#4338ca] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
          >
            <RotateCcw size={24} />
            BACK TO DASHBOARD
          </button>
        </motion.div>
      </div>
    );
  }

  const progress = ((currentQuestionIndex + (isAnswered ? 1 : 0)) / filteredQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Game Dashboard Header */}
      <div className="max-w-4xl w-full mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={resetQuiz}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft size={32} />
          </button>
          
          <div className="flex-1 flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">
               {currentLevel}
             </div>
             <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
               <motion.div 
                 className="h-full bg-indigo-500"
                 initial={{ width: 0 }}
                 animate={{ width: `${(xpInCurrentLevel / XP_PER_LEVEL) * 100}%` }}
               />
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase pr-2">{xpInCurrentLevel}/{XP_PER_LEVEL} XP</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-2xl border-2 border-orange-100 text-orange-600 font-black">
            <Flame size={20} fill="currentColor" className={streak > 0 ? "animate-bounce" : "opacity-30"} />
            <span>{streak}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 40 }}
            />
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-black text-sm">
            <Timer size={18} />
            <span className={timeLeft < 5 ? "text-rose-500 animate-pulse" : ""}>{timeLeft}s</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-slate-800 leading-tight">
                  {currentQuestion.question}
                </h2>
              </div>

              {currentQuestion.code && (
                <div className="bg-slate-900 rounded-2xl p-6 font-mono text-emerald-400 shadow-inner overflow-x-auto relative group">
                  <div className="absolute top-2 right-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Python</div>
                  <pre className="text-sm whitespace-pre-wrap">{currentQuestion.code}</pre>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedOption === index;
                  const isCorrect = isAnswered && index === currentQuestion.correctAnswer;
                  const isWrong = isAnswered && isSelected && index !== currentQuestion.correctAnswer;
                  
                  let styles = "border-slate-200 text-slate-700 bg-white shadow-[0_4px_0_0_#e2e8f0]";
                  
                  if (isSelected && !isAnswered) {
                    styles = "border-indigo-400 text-indigo-700 bg-indigo-50 shadow-[0_4px_0_0_#818cf8]";
                  } else if (isCorrect) {
                    styles = "border-emerald-400 text-emerald-700 bg-emerald-50 shadow-[0_4px_0_0_#34d399]";
                  } else if (isWrong) {
                    styles = "border-rose-400 text-rose-700 bg-rose-50 shadow-[0_4px_0_0_#fb7185]";
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleOptionSelect(index)}
                      disabled={isAnswered}
                      className={`w-full p-5 rounded-2xl border-2 text-left font-black text-lg transition-all active:translate-y-1 active:shadow-none ${styles}`}
                    >
                      <span className="mr-4 text-slate-300">{index + 1}</span>
                      {option}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className={`p-8 border-t-2 transition-colors duration-500 ${
        !isAnswered ? "bg-white border-slate-100" : 
        selectedOption === currentQuestion.correctAnswer ? "bg-emerald-100 border-emerald-200" : "bg-rose-100 border-rose-200"
      }`}>
        <div className="max-w-4xl w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <AnimatePresence>
              {isAnswered && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex items-center gap-4"
                >
                  <div className={`p-3 rounded-full ${selectedOption === currentQuestion.correctAnswer ? "bg-white text-emerald-500" : "bg-white text-rose-500"}`}>
                    {selectedOption === currentQuestion.correctAnswer ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className={`text-2xl font-black ${selectedOption === currentQuestion.correctAnswer ? "text-emerald-700" : "text-rose-700"}`}>
                        {selectedOption === currentQuestion.correctAnswer ? "Amazing!" : "Keep learning!"}
                      </h4>
                      {selectedOption === currentQuestion.correctAnswer && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1"
                        >
                          <TrendingUp size={10} />
                          +{lastXpGained} XP
                        </motion.div>
                      )}
                    </div>
                    <p className={`font-bold ${selectedOption === currentQuestion.correctAnswer ? "text-emerald-600" : "text-rose-600"}`}>
                      {currentQuestion.explanation}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={!isAnswered ? handleSubmit : handleNext}
            disabled={selectedOption === null && !isAnswered}
            className={`w-full md:w-auto px-12 py-4 rounded-2xl font-black text-xl transition-all active:translate-y-1 active:shadow-none ${
              !isAnswered 
                ? (selectedOption === null ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-indigo-500 text-white shadow-[0_6px_0_0_#4338ca]")
                : (selectedOption === currentQuestion.correctAnswer ? "bg-emerald-500 text-white shadow-[0_6px_0_0_#059669]" : "bg-rose-500 text-white shadow-[0_6px_0_0_#e11d48]")
            }`}
          >
            {!isAnswered ? "CHECK" : "CONTINUE"}
          </button>
        </div>
      </footer>
    </div>
  );
}
