import { useState } from 'react';

export default function QuestionCard({ question, onAnswer, disabled }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const options = question.options ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options) : null;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const handleSelect = (i) => {
    if (submitted || disabled) return;
    setSelected(i);
  };

  const handleSubmit = () => {
    if (selected === null || submitted) return;
    setSubmitted(true);
    const answer = options ? options[selected] : selected;
    onAnswer?.(answer, selected);
  };

  const isCorrect = submitted && options && options[selected] === question.correct_answer;

  return (
    <div className="card fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.skill}>{question.skill_name || question.skill}</span>
        {question.difficulty_level && (
          <span className={`badge ${question.difficulty_level === 'easy' ? 'badge-success' : question.difficulty_level === 'medium' ? 'badge-warning' : 'badge-danger'}`}>
            {question.difficulty_level}
          </span>
        )}
      </div>

      {/* Question */}
      <p style={styles.questionText}>{question.question_text || question.text}</p>

      {/* Options */}
      {options ? (
        <div style={styles.options}>
          {options.map((opt, i) => {
            let style = { ...styles.option };
            if (selected === i && !submitted) style = { ...style, ...styles.optionSelected };
            if (submitted && options[i] === question.correct_answer) style = { ...style, ...styles.optionCorrect };
            if (submitted && selected === i && options[i] !== question.correct_answer) style = { ...style, ...styles.optionWrong };

            return (
              <div key={i} style={style} onClick={() => handleSelect(i)}>
                <span style={{
                  ...styles.letter,
                  ...(selected === i && !submitted ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' } : {}),
                  ...(submitted && options[i] === question.correct_answer ? { background: 'var(--success)', borderColor: 'var(--success)', color: 'white' } : {}),
                  ...(submitted && selected === i && options[i] !== question.correct_answer ? { background: 'var(--danger)', borderColor: 'var(--danger)', color: 'white' } : {}),
                }}>{letters[i]}</span>
                <span>{opt}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ margin: '16px 0' }}>
          <input className="input" placeholder="Type your answer..." disabled={submitted}
            onKeyDown={(e) => { if (e.key === 'Enter' && !submitted && e.target.value) { setSubmitted(true); onAnswer?.(e.target.value, null); }}} />
        </div>
      )}

      {/* Explanation */}
      {submitted && question.explanation && (
        <div style={{ ...styles.explanation, ...(isCorrect ? styles.explanationCorrect : styles.explanationWrong) }}>
          <strong>{isCorrect ? '✅ Correct!' : '❌ Not quite.'}</strong><br />
          {question.explanation}
        </div>
      )}

      {/* Submit */}
      {!submitted && options && (
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button className="btn btn-primary" disabled={selected === null} onClick={handleSubmit}>
            Submit Answer
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  skill: { fontSize: '0.85rem', color: 'var(--gray-500)' },
  questionText: { fontSize: '1.15rem', lineHeight: 1.7, marginBottom: 20, color: 'var(--gray-900)' },
  options: { display: 'flex', flexDirection: 'column', gap: 10 },
  option: {
    padding: '13px 18px', border: '2px solid var(--border)', borderRadius: 'var(--radius-md)',
    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.95rem',
  },
  optionSelected: { borderColor: 'var(--accent)', background: 'var(--primary-50)' },
  optionCorrect: { borderColor: 'var(--success)', background: '#ecfdf5', cursor: 'default' },
  optionWrong: { borderColor: 'var(--danger)', background: '#fef2f2', cursor: 'default' },
  letter: {
    width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: '0.82rem', flexShrink: 0,
  },
  explanation: { marginTop: 16, padding: 16, borderRadius: 'var(--radius-md)', fontSize: '0.92rem', lineHeight: 1.6 },
  explanationCorrect: { background: '#ecfdf5', border: '1px solid #86efac', color: '#166534' },
  explanationWrong: { background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' },
};
