import mongoose, { Schema, Document } from "mongoose";

export interface IFileInput {
  name: string;
  mimeType: string;
  data: string; // Base64 or parsed text
}

export interface ISubject extends Document {
  id: string; // Custom client-side UUID
  name: string;
  totalModules: string;
  completedModules: string;
  newModules: string;
  examType: string;
  selectedOutputs: string[];
  files: IFileInput[];
  syllabusFiles: IFileInput[];
  previousPapers: IFileInput[];
  generatedData: any; // Stored StudyGuideData JSON
  createdAt: Date;
}

const FileInputSchema = new Schema({
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  data: { type: String, required: true }
});

const SubjectSchema = new Schema<ISubject>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  totalModules: { type: String, default: "" },
  completedModules: { type: String, default: "" },
  newModules: { type: String, default: "" },
  examType: { type: String, default: "" },
  selectedOutputs: [{ type: String }],
  files: [FileInputSchema],
  syllabusFiles: [FileInputSchema],
  previousPapers: [FileInputSchema],
  generatedData: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

// Avoid re-compiling model in dev hot-reloads
export default mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema);
