import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import QuestionCard from '../components/QuestionCard';

export default function QuizPage() {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    // Fetch adaptive questions
    api.get('/questions/adaptive?limit=5')
      .then(res => { setQuestions(res.data.questions || res.data || []); })
      .catch(() => {
        // Fallback: try getting questions by skill
        api.get('/questions/skill/f0000000-0000-0000-0000-000000000001?limit=5')
          .then(res => setQuestions(res.data || []))
          .catch(() => {});
      })
      .finally(() => setLoading(false));

    // Start a session
    api.post('/sessions').then(res => setSessionId(res.data?.session_id)).catch(() => {});
  }, []);

  const handleAnswer = useCallback(async (answer, selectedIndex) => {
    const q = questions[current];
    const isCorrect = answer === q.correct_answer;
    if (isCorrect) setScore(s => s + 1);

    // Submit attempt
    try {
      await api.post('/attempts', {
        session_id: sessionId,
        question_id: q.question_id,
        skill_id: q.skill_id,
        student_answer: answer,
        is_correct: isCorrect,
      });
    } catch { /* ignore */ }
  }, [current, questions, sessionId]);

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      setDone(true);
      // End session
      if (sessionId) {
        api.post(`/sessions/${sessionId}/end`, { duration: 0, questionsAnswered: questions.length, correctAnswers: score }).catch(() => {});
      }
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" /></div>;

  if (questions.length === 0) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div className="card">
          <h2 style={{ color: 'var(--primary-900)', marginBottom: 12 }}>No Questions Available</h2>
          <p style={{ color: 'var(--gray-500)' }}>Questions will appear here once the database is seeded with curriculum content.</p>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
        <div className="card fade-in" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>{pct >= 80 ? '🎉' : pct >= 60 ? '👏' : '💪'}</div>
          <h2 style={{ color: 'var(--primary-900)', marginBottom: 8 }}>Quiz Complete!</h2>
          <p style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent)', margin: '12px 0' }}>{score}/{questions.length}</p>
          <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>{pct}% correct {pct >= 80 ? '— Excellent!' : pct >= 60 ? '— Good progress!' : '— Keep practicing!'}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setCurrent(0); setScore(0); setDone(false); }}>Try Again</button>
            <a href="/mastery" className="btn btn-secondary">View Mastery</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 750, margin: '0 auto', padding: '24px 20px' }}>
      {/* Progress header */}
      <div style={styles.progressHeader}>
        <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
          Question {current + 1} of {questions.length}
        </span>
        <div style={{ width: 120 }}>
          <div className="progress-bar"><div className="progress-fill blue" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>Score: {score}</span>
      </div>

      <QuestionCard
        key={current}
        question={questions[current]}
        onAnswer={handleAnswer}
      />

      <div style={{ maxWidth: 680, margin: '16px auto 0', textAlign: 'right' }}>
        <button className="btn btn-accent" onClick={handleNext}>
          {current < questions.length - 1 ? 'Next Question →' : 'See Results 🎉'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
};
