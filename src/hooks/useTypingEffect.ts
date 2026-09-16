import { useState, useEffect } from 'react';

export function useTypingEffect(
  words: string[],
  typingSpeed: number = 80,
  deletingSpeed: number = 45,
  pauseDuration: number = 1800
) {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex % words.length];

    const handleTyping = () => {
      if (!isDeleting) {
        // Typing characters forward
        setText(currentWord.substring(0, text.length + 1));
        if (text.length + 1 === currentWord.length) {
          // Finished word, pause before deleting
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        // Deleting characters backward
        setText(currentWord.substring(0, text.length - 1));
        if (text.length - 1 === 0) {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    };

    const timer = setTimeout(
      handleTyping,
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timer);
  }, [text, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDuration]);

  return text;
}
