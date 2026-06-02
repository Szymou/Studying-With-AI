import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = express.Router();

router.use(authMiddleware);

router.post('/start', async (req, res) => {
  try {
    const { questionCount = 10 } = req.body;
    const count = Math.min(questionCount, 50);
    
    const questions = await db.all(`
      SELECT id, question FROM questions ORDER BY RANDOM() LIMIT ?
    `, [count]);
    
    const examId = Date.now();
    const questionsJson = JSON.stringify(questions.map(q => ({ id: q.id, text: q.question })));
    
    await db.run(`
      INSERT INTO exam_records (user_id, questions, answers, score, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.user.userId, questionsJson, '[]', 0, new Date().toISOString(), '']);
    
    res.json({ examId: examId, questions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '开始考试失败' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const { examId, answers } = req.body;
    const userId = req.user.userId;
    
    const record = await db.get(`
      SELECT id, questions FROM exam_records 
      WHERE user_id = ? AND started_at IS NOT NULL AND completed_at = ''
      ORDER BY started_at DESC LIMIT 1
    `, [userId]);
    
    if (!record) {
      return res.status(404).json({ error: '未找到进行中的考试' });
    }
    
    const questions = JSON.parse(record.questions);
    let score = 0;
    const answerDetails = [];
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = answers[i] || '';
      const correctAnswer = await db.get('SELECT answer FROM questions WHERE id = ?', [q.id]);
      const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.answer.trim().toLowerCase();
      if (isCorrect) score++;
      answerDetails.push({
        questionId: q.id,
        question: q.text,
        userAnswer,
        correctAnswer: correctAnswer.answer,
        isCorrect
      });
    }
    
    const finalScore = Math.round((score / questions.length) * 100);
    await db.run(`
      UPDATE exam_records 
      SET answers = ?, score = ?, completed_at = ?
      WHERE id = ?
    `, [JSON.stringify(answerDetails), finalScore, new Date().toISOString(), record.id]);
    
    res.json({ score: finalScore, total: questions.length, details: answerDetails });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '提交考试失败' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const records = await db.all(`
      SELECT id, score, started_at, completed_at 
      FROM exam_records 
      WHERE user_id = ? AND completed_at != ''
      ORDER BY started_at DESC
      LIMIT 20
    `, [req.user.userId]);
    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取历史记录失败' });
  }
});

export default router;
