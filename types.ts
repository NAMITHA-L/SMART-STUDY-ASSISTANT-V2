
export interface SubjectData {
  name: string;
  modules_completed: string[];
  data: any;
}

export interface SavedSubject {
  id: string;
  name: string;
  totalModules: string;
  completedModules: string;
  newModules: string;
  examType: string;
  selectedOutputs: string[];
  files: FileInput[];
  syllabusFiles: FileInput[];
  previousPapers: FileInput[];
  generatedData?: StudyGuideData;
  createdAt: string;
}

export interface FileInput {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export interface ModuleData {
  module_number: string;
  first_half: string;
  second_half: string;
}

export interface MCQ {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  topic?: string;
}

export interface HotQuestion {
  question: string;
  answer: string;
}

export interface Formula {
  name: string;
  formula: string;
  description: string;
}

export interface Diagram {
  title: string;
  description: string;
  ascii_or_mermaid: string;
}

export interface AnswerGuide {
  definition_or_meaning: string;
  detailed_explanation: string;
  diagram_reference_or_ascii: string;
  mermaid_diagram?: string;
  pdf_reference?: string;
  external_links?: string[];
  formula_or_syntax: string;
  example?: string;
  advantages: string[];
  limitations: string[];
}

export interface QuestionWithAnswer {
  question: string;
  marks: number;
  answer_guide: AnswerGuide;
}

export interface QuestionPaper {
  mid_term?: {
    questions: QuestionWithAnswer[];
  };
  end_term?: {
    twelve_mark: QuestionWithAnswer[];
    eight_mark: QuestionWithAnswer[];
  };
}

export interface StudyGuideData {
  subjects: SubjectData[];
  selected_outputs: string[];
  modules: ModuleData[];
  mcqs: MCQ[];
  hot_questions: HotQuestion[];
  formulas: Formula[];
  diagrams: Diagram[];
  question_paper: QuestionPaper;
  detailed_notes?: string;
  error_message?: string;
}

export type StudyTab = 'input' | 'summary' | 'quiz' | 'qa' | 'json';

export enum LoadingState {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}
