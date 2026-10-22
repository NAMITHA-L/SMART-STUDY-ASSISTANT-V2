import React, { useState, useEffect, useCallback } from 'react';
import { Brain, BookOpen, Cpu, ArrowRight, Trash2, Plus, Book, CheckCircle, AlertCircle, FileText, Edit2, Calendar, ClipboardList, Award, Database } from 'lucide-react';
import { generateStudyGuide, FileInput } from './services/geminiService';
import { StudyGuideData, SavedSubject } from './types';
import { ResultsView } from './components/ResultsView';
import { saveSubjectFiles, getSubjectFiles, deleteSubjectFiles } from './src/utils/db';

type UIState = 'SPLASH' | 'LOGIN' | 'DASHBOARD' | 'SUBJECT_SETUP' | 'EXAM_TYPE' | 'OUTPUT_SELECTION' | 'PREVIOUS_PAPERS' | 'CONFIRMATION' | 'GENERATING' | 'RESULTS';
type SubjectSetupMode = 'CONTINUE' | 'CREATE' | 'DELETE' | null;

interface AppState {
  subjectName: string;
  totalModules: string;
  completedModules: string;
  newModules: string;
  examType: string;
  selectedOutputs: string[];
  files: FileInput[];
  syllabusFiles: FileInput[];
  previousPapers: FileInput[];
}

const INITIAL_APP_STATE: AppState = {
  subjectName: '',
  totalModules: '',
  completedModules: '',
  newModules: '',
  examType: '',
  selectedOutputs: [],
  files: [],
  syllabusFiles: [],
  previousPapers: []
};

const OUTPUT_OPTIONS = [
  { id: '1', label: 'Detailed Notes' },
  { id: '2', label: 'MCQs' },
  { id: '3', label: 'Formulas' },
  { id: '4', label: 'Diagrams' },
  { id: '5', label: 'Hot Questions' },
  { id: '6', label: 'Question Paper' }
];

const App: React.FC = () => {
  const [uiState, setUiState] = useState<UIState>('SPLASH');
  const [setupMode, setSetupMode] = useState<SubjectSetupMode>(null);
  const [appState, setAppState] = useState<AppState>(INITIAL_APP_STATE);
  const [error, setError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<StudyGuideData | null>(null);

  // Classroom States
  const [subjects, setSubjects] = useState<SavedSubject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);

  // MongoDB Full-stack States
  interface DbStatus {
    connected: boolean;
    configured: boolean;
    error: string;
    uri: string | null;
  }
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [isLoadingSubject, setIsLoadingSubject] = useState<boolean>(false);

  // Active elapsed timer
  useEffect(() => {
    let interval: any = null;
    if (uiState === 'GENERATING' || isRegenerating) {
      setSecondsElapsed(0);
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uiState, isRegenerating]);

  // Load subjects from MongoDB (if connected) or fallback to localStorage
  const loadSubjects = useCallback(async () => {
    try {
      const res = await fetch("/api/db-status");
      const cType = res.headers.get("content-type") || "";
      if (res.ok && cType.includes("application/json")) {
        const status = await res.json();
        setDbStatus(status);
        if (status.connected) {
          const subres = await fetch("/api/subjects");
          const subCType = subres.headers.get("content-type") || "";
          if (subres.ok && subCType.includes("application/json")) {
            const list = await subres.json();
            setSubjects(list);
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Express backend offline or non-JSON returned, falling back to localStorage", err);
    }

    // Fallback to localStorage
    const stored = localStorage.getItem('smart_study_subjects');
    if (stored) {
      try {
        setSubjects(JSON.parse(stored));
      } catch (e) {
        console.error("Error loading subjects", e);
      }
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const saveSubjects = (updatedSubjects: SavedSubject[]) => {
    setSubjects(updatedSubjects);
    try {
      localStorage.setItem('smart_study_subjects', JSON.stringify(updatedSubjects));
    } catch (e) {
      console.warn("Storage quota exceeded! Saved state in memory only.", e);
    }
  };


  // Splash Screen Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (uiState === 'SPLASH' && e.key === 'Enter') {
        setUiState('DASHBOARD');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materials' | 'papers' | 'syllabus') => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const filePromises = Array.from(selectedFiles).map(async (file) => {
      return new Promise<FileInput>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64String
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const processedFiles = await Promise.all(filePromises);
      if (type === 'materials') {
        setAppState(prev => ({ ...prev, files: [...prev.files, ...processedFiles] }));
      } else if (type === 'syllabus') {
        setAppState(prev => ({ ...prev, syllabusFiles: [...prev.syllabusFiles, ...processedFiles] }));
      } else {
        setAppState(prev => ({ ...prev, previousPapers: [...prev.previousPapers, ...processedFiles] }));
      }
    } catch (err) {
      setError("Failed to read files. Please try again.");
    }
  };

  const generatePrompt = () => {
    let prompt = `Subject: ${appState.subjectName}\n`;
    if (setupMode === 'CREATE') {
      prompt += `Total Modules: ${appState.totalModules}\n`;
    } else if (setupMode === 'CONTINUE') {
      prompt += `Completed Modules: ${appState.completedModules}\n`;
      prompt += `New Modules: ${appState.newModules}\n`;
    }
    prompt += `Exam Type: ${appState.examType}\n`;
    prompt += `Requested Outputs: ${appState.selectedOutputs.join(', ')}\n`;
    
    prompt += `\nSTRICT RULES:\n`;
    prompt += `- Divide each module into First Half and Second Half based on topics or content size.\n`;
    prompt += `- Do NOT generate extra modules.\n`;
    prompt += `- Do NOT regenerate completed modules.\n`;
    prompt += `- Do NOT invent topics not present in material.\n`;
    prompt += `- If insufficient data -> explicitly say: "Insufficient data for this section" in the relevant fields.\n`;
    prompt += `- CRITICAL: If you detect that the user has requested modules that are NOT present in the uploaded materials or the provided context (e.g., they asked for module 4 and 5, but only provided material for 1 and 2), DO NOT invent or assume the content. Instead, populate the "error_message" field in the JSON with a message asking the user to provide the missing materials, and leave the rest of the fields empty or minimal.\n`;
    prompt += `- CRITICAL: Ensure the number of questions and marks exactly matches the requested Exam Type.\n`;
    prompt += `- CRITICAL: If MCQs are requested, generate EXACTLY 10 MCQs for MID TERM and EXACTLY 15 MCQs for END TERM.\n`;

    return prompt;
  };

  const cleanFiles = (files: FileInput[]): FileInput[] => {
    return files.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      data: ''
    }));
  };

  const handleGenerate = async () => {
    setUiState('GENERATING');
    setError(null);
    try {
      const allFiles = [...appState.files, ...appState.syllabusFiles, ...appState.previousPapers];
      const result = await generateStudyGuide(allFiles, generatePrompt(), appState.subjectName);
      
      if (result.error_message) {
        setError(result.error_message);
        setUiState('SUBJECT_SETUP'); // Go back to setup to upload missing files
        return;
      }

      // Generate a new SavedSubject and save its files to IndexedDB
      const newSubId = 'subject_' + Date.now();
      try {
        await saveSubjectFiles(newSubId, appState.files, appState.syllabusFiles, appState.previousPapers);
      } catch (dbErr) {
        console.error("Failed to save files to IndexedDB:", dbErr);
      }

      const newSubject: SavedSubject = {
        id: newSubId,
        name: appState.subjectName,
        totalModules: appState.totalModules,
        completedModules: appState.completedModules,
        newModules: appState.newModules,
        examType: appState.examType,
        selectedOutputs: appState.selectedOutputs,
        files: cleanFiles(appState.files),
        syllabusFiles: cleanFiles(appState.syllabusFiles),
        previousPapers: cleanFiles(appState.previousPapers),
        generatedData: result,
        createdAt: new Date().toLocaleDateString()
      };

      const updatedSubjectsList = [...subjects, newSubject];
      saveSubjects(updatedSubjectsList);

      // Sync full subject (including raw base64 data) to MongoDB Atlas Cloud
      if (dbStatus?.connected) {
        try {
          const fullSubjectToSave: SavedSubject = {
            ...newSubject,
            files: appState.files,
            syllabusFiles: appState.syllabusFiles,
            previousPapers: appState.previousPapers
          };
          await fetch("/api/subjects/save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(fullSubjectToSave)
          });
          console.log("Successfully saved subject to MongoDB Atlas!");
        } catch (dbErr) {
          console.error("Failed to save full subject to MongoDB:", dbErr);
        }
      }

      setActiveSubjectId(newSubId);
      setResultData(result);
      setUiState('RESULTS');
    } catch (err: any) {
      setError(err.message || "Failed to generate. Please try again.");
      setUiState('CONFIRMATION');
    }
  };

  const handleUploadMoreFiles = async (
    newMaterials: FileInput[],
    newSyllabus: FileInput[],
    newPapers: FileInput[]
  ) => {
    if (!activeSubjectId) return;
    
    const subject = subjects.find(s => s.id === activeSubjectId);
    if (!subject) return;

    setIsRegenerating(true);
    try {
      // 1. Fetch original files to combine
      let originalFiles: FileInput[] = [];
      let originalSyllabus: FileInput[] = [];
      let originalPapers: FileInput[] = [];

      let fetchedFromDb = false;
      if (dbStatus?.connected) {
        try {
          const res = await fetch(`/api/subjects/${activeSubjectId}`);
          const cType = res.headers.get("content-type") || "";
          if (res.ok && cType.includes("application/json")) {
            const detailed = await res.json();
            if (detailed) {
              originalFiles = detailed.files || [];
              originalSyllabus = detailed.syllabusFiles || [];
              originalPapers = detailed.previousPapers || [];
              fetchedFromDb = true;
            }
          }
        } catch (dbErr) {
          console.warn("Failed to fetch original files from MongoDB, trying local IndexedDB fallback:", dbErr);
        }
      }

      if (!fetchedFromDb) {
        try {
          const storedRecord = await getSubjectFiles(activeSubjectId);
          if (storedRecord) {
            originalFiles = storedRecord.files || [];
            originalSyllabus = storedRecord.syllabusFiles || [];
            originalPapers = storedRecord.previousPapers || [];
          }
        } catch (dbErr) {
          console.error("Failed to fetch original files from IndexedDB, falling back:", dbErr);
        }
      }

      // 2. Combine existing base64 files with new ones
      const updatedMaterials = [...originalFiles, ...newMaterials];
      const updatedSyllabus = [...originalSyllabus, ...newSyllabus];
      const updatedPapers = [...originalPapers, ...newPapers];

      // 3. Prepare all files combined
      const allFiles = [...updatedMaterials, ...updatedSyllabus, ...updatedPapers];

      // 4. Formulate the prompt using stored values
      let prompt = `Subject: ${subject.name}\n`;
      if (subject.totalModules) {
        prompt += `Total Modules: ${subject.totalModules}\n`;
      } else {
        prompt += `Completed Modules: ${subject.completedModules}\n`;
        prompt += `New Modules: ${subject.newModules}\n`;
      }
      prompt += `Exam Type: ${subject.examType}\n`;
      prompt += `Requested Outputs: ${subject.selectedOutputs.join(', ')}\n`;
      
      prompt += `\nSTRICT RULES:\n`;
      prompt += `- Divide each module into First Half and Second Half based on topics or content size.\n`;
      prompt += `- Do NOT generate extra modules.\n`;
      prompt += `- Do NOT regenerate completed modules.\n`;
      prompt += `- Do NOT invent topics not present in material.\n`;
      prompt += `- If insufficient data -> explicitly say: "Insufficient data for this section" in the relevant fields.\n`;
      prompt += `- CRITICAL: If you detect that the user has requested modules that are NOT present in the uploaded materials or the provided context (e.g., they asked for module 4 and 5, but only provided material for 1 and 2), DO NOT invent or assume the content. Instead, populate the "error_message" field in the JSON with a message asking the user to provide the missing materials, and leave the rest of the fields empty or minimal.\n`;
      prompt += `- CRITICAL: Ensure the number of questions and marks exactly matches the requested Exam Type.\n`;
      prompt += `- CRITICAL: If MCQs are requested, generate EXACTLY 10 MCQs for MID TERM and EXACTLY 15 MCQs for END TERM.\n`;

      // 5. Run generator with combined context
      const result = await generateStudyGuide(allFiles, prompt, subject.name);

      if (result.error_message) {
        throw new Error(result.error_message);
      }

      // 6. Save updated files back to IndexedDB (local fallback)
      try {
        await saveSubjectFiles(activeSubjectId, updatedMaterials, updatedSyllabus, updatedPapers);
      } catch (dbErr) {
        console.error("Failed to update files in IndexedDB:", dbErr);
      }

      // 7. Build updated subject model with clean files for localStorage
      const updatedSubject: SavedSubject = {
        ...subject,
        files: cleanFiles(updatedMaterials),
        syllabusFiles: cleanFiles(updatedSyllabus),
        previousPapers: cleanFiles(updatedPapers),
        generatedData: result
      };

      // 8. Save in state & localStorage (lightweight metadata)
      const updatedList = subjects.map(s => s.id === activeSubjectId ? updatedSubject : s);
      saveSubjects(updatedList);

      // 9. Save full update with raw base64 data to MongoDB Cloud
      if (dbStatus?.connected) {
        try {
          const fullSubjectToSave: SavedSubject = {
            ...updatedSubject,
            files: updatedMaterials,
            syllabusFiles: updatedSyllabus,
            previousPapers: updatedPapers
          };
          await fetch("/api/subjects/save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(fullSubjectToSave)
          });
          console.log("Successfully saved updated subject to MongoDB Atlas!");
        } catch (dbErr) {
          console.error("Failed to save updated subject to MongoDB:", dbErr);
        }
      }
      
      // Update result data view
      setResultData(result);
      setIsRegenerating(false);
    } catch (err: any) {
      setIsRegenerating(false);
      console.error("Failed to merge and regenerate", err);
      throw err;
    }
  };

  const renderSplash = () => (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-transparent text-[#0a192f] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
      <div className="relative z-10 max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-center space-x-3.5">
          <div className="w-4 h-4 bg-[#4285F4] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-4 h-4 bg-[#EA4335] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-4 h-4 bg-[#FBBC05] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          <div className="w-4 h-4 bg-[#34A853] rounded-full animate-bounce" style={{ animationDelay: '450ms' }}></div>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight text-gray-900 leading-tight">
          Smart Study <span className="text-[#4285F4]">Assistant</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 font-medium mb-12 max-w-md mx-auto">
          Your Agentic Friend—transforming class notes, syllabus, and papers into custom tailored study material.
        </p>
        <button 
          onClick={() => setUiState('LOGIN')}
          className="group flex items-center mx-auto px-8 py-3.5 bg-[#0a192f] hover:bg-[#122c4f] text-white rounded-2xl text-lg font-semibold transition-all shadow-[0_4px_20px_rgba(10,25,47,0.15)] hover:shadow-[0_6px_24px_rgba(10,25,47,0.25)] hover:translate-y-[-1px] tracking-wide"
        >
          Get Started <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1.5 transition-transform" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f] relative">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
      <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10">
        <h2 className="text-3xl font-bold mb-8 text-center text-gray-900 tracking-tight">Welcome Back</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Username</label>
            <input 
              type="text" 
              className="w-full p-3.5 border border-gray-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-[#4285F4] focus:bg-white outline-none transition-all"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Password</label>
            <input 
              type="password" 
              className="w-full p-3.5 border border-gray-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-[#4285F4] focus:bg-white outline-none transition-all"
              placeholder="Enter password"
            />
          </div>
          <button 
            onClick={() => setUiState('DASHBOARD')}
            className="w-full mt-6 py-3.5 rounded-xl bg-[#0a192f] text-white hover:bg-[#122c4f] font-semibold text-base transition-all shadow-md tracking-wide"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );

  const handleRenameSubject = async (id: string) => {
    if (!editingName.trim()) return;
    const trimmedName = editingName.trim();
    
    // Update locally
    const updated = subjects.map(s => s.id === id ? { ...s, name: trimmedName } : s);
    saveSubjects(updated);

    // Sync to MongoDB
    if (dbStatus?.connected) {
      try {
        const res = await fetch(`/api/subjects/${id}`);
        const cType = res.headers.get("content-type") || "";
        if (res.ok && cType.includes("application/json")) {
          const fullSubj = await res.json();
          fullSubj.name = trimmedName;
          await fetch("/api/subjects/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fullSubj)
          });
        }
      } catch (err) {
        console.error("Failed to rename on MongoDB:", err);
      }
    }

    setEditingSubjectId(null);
    setEditingName('');
  };

  const handleDeleteSubject = async (id: string) => {
    const updated = subjects.filter(s => s.id !== id);
    saveSubjects(updated);
    
    // Local IndexedDB deletion
    try {
      await deleteSubjectFiles(id);
    } catch (dbErr) {
      console.error("Failed to delete files from IndexedDB:", dbErr);
    }

    // Sync to MongoDB
    if (dbStatus?.connected) {
      try {
        await fetch(`/api/subjects/${id}`, {
          method: "DELETE"
        });
      } catch (err) {
        console.error("Failed to delete from MongoDB:", err);
      }
    }

    setDeletingSubjectId(null);
    if (activeSubjectId === id) {
      setActiveSubjectId(null);
      setUiState('DASHBOARD');
    }
  };

  const handleSelectSubject = async (subj: SavedSubject) => {
    if (editingSubjectId || deletingSubjectId) return;
    setIsLoadingSubject(true);
    try {
      let detailedSubj = subj;
      if (dbStatus?.connected) {
        const res = await fetch(`/api/subjects/${subj.id}`);
        const cType = res.headers.get("content-type") || "";
        if (res.ok && cType.includes("application/json")) {
          detailedSubj = await res.json();
        }
      }
      
      setActiveSubjectId(detailedSubj.id);
      setResultData(detailedSubj.generatedData || null);
      setAppState({
        ...INITIAL_APP_STATE,
        subjectName: detailedSubj.name,
        totalModules: detailedSubj.totalModules || '',
        completedModules: detailedSubj.completedModules || '',
        newModules: detailedSubj.newModules || '',
        examType: detailedSubj.examType || '',
        selectedOutputs: detailedSubj.selectedOutputs || [],
        files: detailedSubj.files || [],
        syllabusFiles: detailedSubj.syllabusFiles || [],
        previousPapers: detailedSubj.previousPapers || []
      });
      setUiState('RESULTS');
    } catch (err) {
      console.error("Error loading subject details from MongoDB:", err);
      // fallback to list item representation
      setActiveSubjectId(subj.id);
      setResultData(subj.generatedData || null);
      setAppState({
        ...INITIAL_APP_STATE,
        subjectName: subj.name,
        totalModules: subj.totalModules || '',
        completedModules: subj.completedModules || '',
        newModules: subj.newModules || '',
        examType: subj.examType || '',
        selectedOutputs: subj.selectedOutputs || [],
        files: subj.files || [],
        syllabusFiles: subj.syllabusFiles || [],
        previousPapers: subj.previousPapers || []
      });
      setUiState('RESULTS');
    } finally {
      setIsLoadingSubject(false);
    }
  };

  const renderDashboard = () => {
    const googleColors = [
      'bg-[#4285F4]', // Blue
      'bg-[#EA4335]', // Red
      'bg-[#FBBC05]', // Yellow
      'bg-[#34A853]'  // Green
    ];

    return (
      <div className="min-h-screen px-4 py-12 md:px-12 bg-transparent text-[#0a192f] relative max-w-7xl mx-auto">
        <div className="absolute inset-0 opacity-[0.01] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        
        {/* Header */}
        <div className="mb-10 text-center sm:text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center sm:justify-start">
              <span className="w-2 h-7 bg-[#4285F4] rounded-full mr-3"></span>
              Academic Classroom
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Manage your persistent subjects, continue your course materials, or upload new files.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold ${
              dbStatus?.connected 
                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                : 'bg-amber-50/50 border-amber-100 text-amber-800'
            }`}>
              <Database className={`w-4 h-4 ${dbStatus?.connected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              <span>
                {dbStatus?.connected ? 'Cloud Active (MongoDB)' : 'Browser Mode (IndexedDB)'}
              </span>
            </div>
          </div>
        </div>


        {/* Classroom Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 relative z-10">
          
          {/* Box 1: Add New Subject */}
          <button 
            onClick={() => { 
              setSetupMode('CREATE'); 
              setAppState(INITIAL_APP_STATE);
              setUiState('SUBJECT_SETUP'); 
            }} 
            className="group flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-gray-200/80 hover:border-[#4285F4] hover:bg-blue-50/10 hover:shadow-[0_8px_30px_rgba(0,0,0,0.02)] transition-all duration-300 text-center min-h-[280px]"
          >
            <div className="p-4 rounded-full bg-blue-50 text-[#4285F4] mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm">
              <Plus className="w-8 h-8" strokeWidth={2.5} />
            </div>
            <span className="block font-bold text-base text-gray-900">Upload New Subject</span>
            <span className="block text-xs text-gray-400 font-medium mt-1.5 max-w-[180px] leading-relaxed">
              Define syllabus, study guides, and custom parameters
            </span>
          </button>

          {/* Existing Subject Cards */}
          {subjects.map((subj, index) => {
            const isEditing = editingSubjectId === subj.id;
            const isDeleting = deletingSubjectId === subj.id;
            const headerColor = googleColors[index % googleColors.length];

            return (
              <div 
                key={subj.id}
                className="group flex flex-col bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.05)] hover:translate-y-[-2px] transition-all duration-300 min-h-[280px] overflow-hidden relative"
              >
                {/* Visual Banner Accent (Classroom style) */}
                <div className={`p-5 text-white ${headerColor} relative overflow-hidden shrink-0`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-8 translate-y-[-16px] blur-sm"></div>
                  {isEditing ? (
                    <div className="flex items-center space-x-2 relative z-10">
                      <input 
                        type="text"
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-900 border-0 outline-none bg-white shadow-sm"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubject(subj.id);
                          if (e.key === 'Escape') setEditingSubjectId(null);
                        }}
                      />
                      <button 
                        onClick={() => handleRenameSubject(subj.id)}
                        className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-bold transition-all"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="relative z-10 pr-6">
                      <h3 className="font-bold text-lg leading-tight truncate" title={subj.name}>
                        {subj.name}
                      </h3>
                      <p className="text-[10px] text-white/80 font-medium mt-1 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Created {subj.createdAt || 'recently'}
                      </p>
                    </div>
                  )}

                  {!isEditing && (
                    <button 
                      onClick={() => {
                        setEditingSubjectId(subj.id);
                        setEditingName(subj.name);
                      }}
                      className="absolute top-4 right-4 p-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white transition-all opacity-0 group-hover:opacity-100"
                      title="Rename Subject"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Content Details */}
                <div 
                  onClick={() => handleSelectSubject(subj)}
                  className="p-5 flex-1 flex flex-col justify-between cursor-pointer relative"
                >
                  {isLoadingSubject && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20">
                      <div className="w-5 h-5 border-2 border-[#4285F4] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <div className="space-y-2.5">
                    <div className="flex items-center text-xs text-gray-500 font-medium">
                      <FileText className="w-3.5 h-3.5 mr-2 text-gray-400 shrink-0" />
                      <span className="truncate">
                        {(subj.files || []).length} Materials
                        {(subj.syllabusFiles || []).length > 0 && ` • ${(subj.syllabusFiles || []).length} Syllabus`}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-gray-500 font-medium">
                      <ClipboardList className="w-3.5 h-3.5 mr-2 text-gray-400 shrink-0" />
                      <span>
                        {subj.totalModules ? `Modules: ${subj.totalModules}` : `Cont.: Comp ${subj.completedModules} | New ${subj.newModules}`}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-gray-500 font-medium">
                      <Award className="w-3.5 h-3.5 mr-2 text-gray-400 shrink-0" />
                      <span>{subj.examType || 'Term Exams'}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-[10px] text-[#4285F4] font-semibold uppercase tracking-wider group-hover:underline">
                      Open Lab &rarr;
                    </span>
                    
                    {isDeleting ? (
                      <div className="flex items-center space-x-1.5 text-[10px]">
                        <span className="text-rose-500 font-bold">Sure?</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subj.id); }}
                          className="px-2 py-0.5 bg-rose-500 text-white font-semibold rounded hover:bg-rose-600 transition-colors"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeletingSubjectId(null); }}
                          className="px-2 py-0.5 bg-gray-200 text-gray-700 font-semibold rounded hover:bg-gray-300 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSubjectId(subj.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {subjects.length === 0 && (
          <div className="mt-12 p-10 text-center bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.01)] max-w-md mx-auto relative z-10">
            <Book className="w-12 h-12 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
            <h4 className="text-lg font-bold text-gray-800">No subjects added</h4>
            <p className="text-xs text-gray-500 font-medium mt-1 max-w-[280px] mx-auto leading-relaxed">
              Click "Upload New Subject" to begin persistent academic generation!
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSubjectSetup = () => {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f] relative py-12">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        <div className="max-w-xl w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10">
          <h2 className="text-2xl font-bold mb-8 text-gray-900 tracking-tight border-b border-gray-100 pb-4 flex items-center">
            {setupMode === 'CONTINUE' && <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4] mr-3"></span>}
            {setupMode === 'CREATE' && <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] mr-3"></span>}
            {setupMode === 'DELETE' && <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335] mr-3"></span>}
            {setupMode === 'CONTINUE' && 'Continue Subject'}
            {setupMode === 'CREATE' && 'Create Subject'}
            {setupMode === 'DELETE' && 'Delete Subject'}
          </h2>
          
          {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 font-medium rounded-xl text-sm">{error}</div>}
 
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Subject Name</label>
              <input 
                type="text" 
                className="w-full p-3.5 border border-gray-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-[#4285F4] focus:bg-white outline-none transition-all"
                value={appState.subjectName}
                onChange={e => setAppState({...appState, subjectName: e.target.value})}
                placeholder="e.g., Data Structures"
              />
            </div>

            {setupMode === 'CONTINUE' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Completed Modules (e.g., 1,2)</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 border border-gray-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-[#4285F4] focus:bg-white outline-none transition-all"
                    value={appState.completedModules}
                    onChange={e => setAppState({...appState, completedModules: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">New Modules to Upload</label>
                  <input 
                    type="text" 
                    className="w-full p-3.5 border border-gray-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-[#4285F4] focus:bg-white outline-none transition-all"
                    value={appState.newModules}
                    onChange={e => setAppState({...appState, newModules: e.target.value})}
                  />
                </div>
                <div className="p-5 border border-gray-100 rounded-2xl bg-blue-50/25">
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Syllabus (Optional)</label>
                  <input type="file" multiple onChange={(e) => handleFileUpload(e, 'syllabus')} className="w-full text-gray-600 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#4285F4]/10 file:text-[#4285F4] hover:file:bg-[#4285F4]/20 cursor-pointer" />
                  {appState.syllabusFiles.length > 0 && <p className="text-sm text-[#34A853] font-semibold mt-2">{appState.syllabusFiles.length} files attached</p>}
                </div>
                <div className="p-5 border border-gray-100 rounded-2xl bg-[#0a192f]/5">
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">New Materials (Required)</label>
                  <input type="file" multiple onChange={(e) => handleFileUpload(e, 'materials')} className="w-full text-gray-600 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0a192f] file:text-white hover:file:bg-[#122c4f] cursor-pointer" />
                  {appState.files.length > 0 && <p className="text-sm text-[#34A853] font-semibold mt-2">{appState.files.length} files attached</p>}
                </div>
              </>
            )}

            {setupMode === 'CREATE' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Total Modules</label>
                  <input 
                    type="number" 
                    className="w-full p-3.5 border border-gray-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-[#4285F4] focus:bg-white outline-none transition-all"
                    value={appState.totalModules}
                    onChange={e => setAppState({...appState, totalModules: e.target.value})}
                  />
                </div>
                <div className="p-5 border border-gray-100 rounded-2xl bg-blue-50/25">
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Syllabus (Optional)</label>
                  <input type="file" multiple onChange={(e) => handleFileUpload(e, 'syllabus')} className="w-full text-gray-600 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#4285F4]/10 file:text-[#4285F4] hover:file:bg-[#4285F4]/20 cursor-pointer" />
                  {appState.syllabusFiles.length > 0 && <p className="text-sm text-[#34A853] font-semibold mt-2">{appState.syllabusFiles.length} files attached</p>}
                </div>
                <div className="p-5 border border-gray-100 rounded-2xl bg-[#0a192f]/5">
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Study Materials (Required)</label>
                  <input type="file" multiple onChange={(e) => handleFileUpload(e, 'materials')} className="w-full text-gray-600 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0a192f] file:text-white hover:file:bg-[#122c4f] cursor-pointer" />
                  {appState.files.length > 0 && <p className="text-sm text-[#34A853] font-semibold mt-2">{appState.files.length} files attached</p>}
                </div>
              </>
            )}

            {setupMode === 'DELETE' && (
              <div>
                <label className="block text-xs font-semibold text-rose-500 mb-2 uppercase tracking-wider">Type YES to confirm</label>
                <input 
                  type="text" 
                  className="w-full p-3.5 border border-rose-200 bg-[#fbfbfb] text-gray-900 font-medium rounded-xl focus:border-rose-500 focus:bg-white outline-none transition-all"
                  placeholder="YES"
                  id="deleteConfirm"
                />
              </div>
            )}

            <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
              <button onClick={() => setUiState('DASHBOARD')} className="px-6 py-3 text-gray-500 font-semibold hover:text-gray-900 transition-colors uppercase tracking-wider text-xs">Back</button>
              <button 
                onClick={() => {
                  setError(null);
                  if (!appState.subjectName) { setError("Subject name is required"); return; }
                  
                  if (setupMode === 'DELETE') {
                    const confirmVal = (document.getElementById('deleteConfirm') as HTMLInputElement)?.value;
                    if (confirmVal === 'YES') {
                      setAppState(INITIAL_APP_STATE);
                      setUiState('DASHBOARD');
                      alert("Subject deleted.");
                    } else {
                      setError("Type YES to confirm");
                    }
                    return;
                  }

                  if (setupMode === 'CREATE' && !appState.totalModules) { setError("Total modules required"); return; }
                  if (setupMode === 'CONTINUE' && (!appState.completedModules || !appState.newModules)) { setError("Module info required"); return; }
                  if (appState.files.length === 0) { setError("Please upload materials"); return; }

                  setUiState('EXAM_TYPE');
                }}
                className="px-8 py-3 bg-[#0a192f] hover:bg-[#122c4f] text-white rounded-xl font-semibold transition-all shadow-md text-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderExamType = () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f]">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-900 tracking-tight border-b border-gray-100 pb-4">Step 1 → Exam Type</h2>
        <div className="space-y-4">
          <button 
            onClick={() => { setAppState({...appState, examType: 'Mid Term'}); setUiState('OUTPUT_SELECTION'); }}
            className="w-full flex items-center justify-center p-4.5 rounded-2xl border border-gray-200 bg-white hover:border-[#4285F4] hover:bg-blue-50/20 transition-all font-semibold text-base text-gray-900 shadow-sm"
          >
            Mid Term (50 Questions)
          </button>
          <button 
            onClick={() => { setAppState({...appState, examType: 'End Term'}); setUiState('OUTPUT_SELECTION'); }}
            className="w-full flex items-center justify-center p-4.5 rounded-2xl border border-gray-200 bg-white hover:border-[#EA4335] hover:bg-red-50/20 transition-all font-semibold text-base text-gray-900 shadow-sm"
          >
            End Term (100 Questions)
          </button>
        </div>
        <div className="mt-8 text-center">
          <button onClick={() => setUiState('SUBJECT_SETUP')} className="px-6 py-3 text-gray-500 font-semibold hover:text-gray-900 transition-colors uppercase tracking-wider text-xs">Back</button>
        </div>
      </div>
    </div>
  );

  const renderOutputSelection = () => {
    const toggleOutput = (label: string) => {
      setAppState(prev => {
        const exists = prev.selectedOutputs.includes(label);
        if (exists) {
          return { ...prev, selectedOutputs: prev.selectedOutputs.filter(o => o !== label) };
        } else {
          return { ...prev, selectedOutputs: [...prev.selectedOutputs, label] };
        }
      });
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f] relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        <div className="max-w-xl w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 tracking-tight">Step 2 → Study Materials</h2>
          <p className="text-gray-500 font-medium mb-8 text-sm">Select required outputs for generation:</p>
          
          {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 font-medium rounded-xl text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            {OUTPUT_OPTIONS.map(opt => {
              const isSelected = appState.selectedOutputs.includes(opt.label);
              let activeBorderColor = 'border-gray-200 hover:border-[#4285F4]';
              if (isSelected) {
                if (opt.id === '1') activeBorderColor = 'border-[#4285F4] bg-blue-50/20 text-[#4285F4]';
                else if (opt.id === '2') activeBorderColor = 'border-[#EA4335] bg-red-50/20 text-[#EA4335]';
                else if (opt.id === '3') activeBorderColor = 'border-[#FBBC05] bg-yellow-50/25 text-[#B28200]';
                else if (opt.id === '4') activeBorderColor = 'border-[#34A853] bg-green-50/20 text-[#34A853]';
                else activeBorderColor = 'border-[#0a192f] bg-[#0a192f]/5 text-[#0a192f]';
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleOutput(opt.label)}
                  className={`p-4 rounded-2xl border font-semibold transition-all text-sm text-left flex items-center justify-between ${isSelected ? activeBorderColor : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'}`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-current"></span>}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
            <button onClick={() => setUiState('EXAM_TYPE')} className="px-6 py-3 text-gray-500 font-semibold hover:text-gray-900 transition-colors uppercase tracking-wider text-xs">Back</button>
            <button 
              onClick={() => {
                setError(null);
                if (appState.selectedOutputs.length === 0) {
                  setError("Must select at least one output");
                  return;
                }
                setUiState('PREVIOUS_PAPERS');
              }}
              className="px-8 py-3 bg-[#0a192f] hover:bg-[#122c4f] text-white rounded-xl font-semibold transition-all shadow-md text-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPreviousPapers = () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f] relative">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
      <div className="max-w-xl w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10">
        <h2 className="text-2xl font-bold mb-2 text-gray-900 tracking-tight">Step 3 → Previous Papers</h2>
        <p className="mb-8 text-gray-500 font-medium text-sm">Upload previous year question papers for exact paper patterns (Optional)</p>
        
        <div className="mb-8 p-5 border border-gray-100 rounded-2xl bg-blue-50/25">
          <input type="file" multiple onChange={(e) => handleFileUpload(e, 'papers')} className="w-full text-gray-600 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#4285F4]/10 file:text-[#4285F4] hover:file:bg-[#4285F4]/20 cursor-pointer" />
          {appState.previousPapers.length > 0 && <p className="text-sm text-[#34A853] font-semibold mt-2">{appState.previousPapers.length} papers attached</p>}
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={() => setUiState('CONFIRMATION')}
            className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 font-semibold transition-all text-sm"
          >
            Skip / No
          </button>
          <button 
            onClick={() => setUiState('CONFIRMATION')}
            className="flex-1 py-3.5 rounded-xl bg-[#0a192f] text-white hover:bg-[#122c4f] font-semibold transition-all shadow-md text-sm"
          >
            Continue / Yes
          </button>
        </div>
        <div className="mt-8 text-center">
          <button onClick={() => setUiState('OUTPUT_SELECTION')} className="px-6 py-3 text-gray-500 font-semibold hover:text-gray-900 transition-colors uppercase tracking-wider text-xs">Back</button>
        </div>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f] relative py-12">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
      <div className="max-w-xl w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-900 tracking-tight border-b border-gray-100 pb-4">Confirmation</h2>
        
        {error && <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 font-medium rounded-xl text-sm">{error}</div>}

        <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 mb-10 shadow-sm">
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Subject Name</span>
            <span className="font-semibold text-gray-900 text-sm">{appState.subjectName}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Modules</span>
            <span className="font-semibold text-right text-gray-900 text-sm">
              {setupMode === 'CREATE' ? `Total: ${appState.totalModules}` : `Completed: ${appState.completedModules} | New: ${appState.newModules}`}
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Exam Type</span>
            <span className="font-semibold text-gray-900 text-sm">{appState.examType}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-3">
            <span className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Outputs</span>
            <span className="font-semibold text-right max-w-[200px] text-gray-900 text-sm">{appState.selectedOutputs.join(', ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 font-semibold uppercase tracking-wider text-xs">Previous paper</span>
            <span className="font-semibold text-gray-900 text-sm">{appState.previousPapers.length > 0 ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={() => setUiState('DASHBOARD')}
            className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 font-semibold transition-all text-sm"
          >
            Edit Settings
          </button>
          <button 
            onClick={handleGenerate}
            className="flex-1 py-3.5 rounded-xl bg-[#0a192f] hover:bg-[#122c4f] text-white font-semibold transition-all shadow-md text-sm"
          >
            Confirm & Generate
          </button>
        </div>
      </div>
    </div>
  );

  const renderGenerating = () => {
    const getGeneratingStatus = (seconds: number) => {
      if (seconds < 8) return { step: 1, text: "Reading files and parsing document nodes..." };
      if (seconds < 16) return { step: 2, text: "Structuring academic module chapters..." };
      if (seconds < 24) return { step: 3, text: "Cross-referencing syllabus benchmarks & topics..." };
      if (seconds < 32) return { step: 4, text: "Synthesizing dynamic notes & formulas..." };
      if (seconds < 40) return { step: 5, text: "Generating customized exam questions..." };
      if (seconds < 48) return { step: 6, text: "Correlating with past year exam questions..." };
      return { step: 7, text: "Assembling final classroom study dashboard..." };
    };

    const status = getGeneratingStatus(secondsElapsed);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-transparent text-[#0a192f] relative py-12">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.04)] relative z-10 flex flex-col items-center">
          
          {/* Animated Spinner Icon with dynamic timer inside */}
          <div className="relative w-32 h-32 mb-8 flex items-center justify-center bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
            <div className="absolute inset-1.5 border-[3px] border-gray-100 rounded-full"></div>
            {/* Dynamic spin based on four Google colors */}
            <div className="absolute inset-1.5 border-[3px] border-t-[#4285F4] border-r-[#EA4335] border-b-[#FBBC05] border-l-[#34A853] rounded-full animate-spin"></div>
            
            <div className="text-center z-10">
              <span className="block text-3xl font-extrabold text-gray-900 tracking-tight leading-none">{secondsElapsed}s</span>
              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Elapsed</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2 text-gray-900 tracking-tight">Synthesizing Materials</h2>
          
          {/* Dynamic Active Step Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 text-[#4285F4] rounded-full text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4] animate-pulse"></span>
            <span>Step {status.step} of 7 • {Math.min(Math.round((status.step / 7) * 100), 99)}%</span>
          </div>

          {/* Current Status message */}
          <p className="text-sm font-semibold text-gray-800 text-center leading-relaxed h-12 flex items-center justify-center max-w-xs mb-8">
            "{status.text}"
          </p>

          {/* Est completion note */}
          <div className="w-full bg-gray-50/50 rounded-2xl p-4.5 border border-gray-100 text-left">
            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Analyzing configuration</span>
            <div className="space-y-1.5 text-xs text-gray-500 font-medium">
              <div className="flex justify-between">
                <span>Total Files:</span>
                <span className="font-bold text-gray-700">{appState.files.length + appState.syllabusFiles.length + appState.previousPapers.length} Documents</span>
              </div>
              <div className="flex justify-between">
                <span>Targets:</span>
                <span className="font-bold text-gray-700">{appState.selectedOutputs.length} Outputs</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5 mt-1.5 text-gray-400 font-semibold">
                <span>Est. Total Time:</span>
                <span>45s - 75s</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="modern-font min-h-screen bg-[#fdf7f4]">
      {/* Google-style minimalist top brand bar */}
      <div className="fixed top-0 left-0 w-full h-1 flex z-50">
        <div className="flex-1 bg-[#4285F4]"></div>
        <div className="flex-1 bg-[#EA4335]"></div>
        <div className="flex-1 bg-[#FBBC05]"></div>
        <div className="flex-1 bg-[#34A853]"></div>
      </div>
      <div className="fixed top-1 left-0 w-full p-2.5 bg-white/90 backdrop-blur-md text-[10px] text-gray-400 font-mono z-50 flex justify-between border-b border-gray-100">
        <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-[#34A853] mr-1.5 animate-pulse"></span>ACTIVE: {uiState}</span>
        <span className="font-semibold uppercase tracking-widest text-gray-500 text-[9px]">Smart Study Assistant</span>
      </div>
      <div className="pt-8">
        {uiState === 'SPLASH' && renderSplash()}
        {uiState === 'LOGIN' && renderLogin()}
        {uiState === 'DASHBOARD' && renderDashboard()}
        {uiState === 'SUBJECT_SETUP' && renderSubjectSetup()}
        {uiState === 'EXAM_TYPE' && renderExamType()}
        {uiState === 'OUTPUT_SELECTION' && renderOutputSelection()}
        {uiState === 'PREVIOUS_PAPERS' && renderPreviousPapers()}
        {uiState === 'CONFIRMATION' && renderConfirmation()}
        {uiState === 'GENERATING' && renderGenerating()}
        {uiState === 'RESULTS' && (() => {
          const activeSub = subjects.find(s => s.id === activeSubjectId);
          if (!activeSub) return null;
          return (
            <ResultsView 
              subject={activeSub} 
              onReset={() => { setUiState('DASHBOARD'); setActiveSubjectId(null); setAppState(INITIAL_APP_STATE); }}
              onUploadMore={handleUploadMoreFiles}
              isGenerating={isRegenerating}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default App;
