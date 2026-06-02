export interface Question {
  id: number;
  category: string;
  subcategory: string;
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string;
  created_at: string;
}

export interface UserProgress {
  id: number;
  user_id: number;
  question_id: number;
  is_correct: boolean;
  answered_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface ExamRecord {
  id: number;
  user_id: number;
  questions: string;
  answers: string;
  score: number;
  started_at: string;
  completed_at: string;
}
