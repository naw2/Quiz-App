export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Question {
  id: number;
  difficulty: Difficulty;
  question: string;
  code?: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export const pythonQuestions: Question[] = [
  // BEGINNER
  {
    id: 1,
    difficulty: 'Beginner',
    question: "What is the output of this code?",
    code: "print(type(5.0))",
    options: ["<class 'int'>", "<class 'float'>", "<class 'number'>", "<class 'str'>"],
    correctAnswer: 1,
    explanation: "5.0 is a decimal number, which Python classifies as a 'float'."
  },
  {
    id: 2,
    difficulty: 'Beginner',
    question: "How do you create a variable with the numeric value 5?",
    options: ["x = 5", "x = int(5)", "Both of the above", "None of the above"],
    correctAnswer: 2,
    explanation: "In Python, you can simply assign 5 to x, or explicitly cast it using int(). Both work."
  },
  {
    id: 3,
    difficulty: 'Beginner',
    question: "What is the correct way to start a function?",
    options: ["function myFunc():", "def myFunc():", "create myFunc():", "func myFunc():"],
    correctAnswer: 1,
    explanation: "The 'def' keyword is used to define functions in Python."
  },
  
  // INTERMEDIATE
  {
    id: 4,
    difficulty: 'Intermediate',
    question: "What is the output of this list comprehension?",
    code: "nums = [1, 2, 3]\nprint([x*x for x in nums if x > 1])",
    options: ["[1, 4, 9]", "[4, 9]", "[1, 4]", "[2, 3]"],
    correctAnswer: 1,
    explanation: "The condition 'if x > 1' filters out 1. Then it squares 2 and 3, resulting in [4, 9]."
  },
  {
    id: 5,
    difficulty: 'Intermediate',
    question: "Which method is used to add an element to the end of a list?",
    options: ["add()", "push()", "append()", "insert()"],
    correctAnswer: 2,
    explanation: "The append() method adds a single item to the end of an existing list."
  },
  {
    id: 6,
    difficulty: 'Intermediate',
    question: "What does the 'self' parameter in a class method represent?",
    options: ["The class itself", "A global variable", "The instance of the object", "The parent class"],
    correctAnswer: 2,
    explanation: "'self' refers to the specific instance of the class that the method is being called on."
  },

  // ADVANCED
  {
    id: 7,
    difficulty: 'Advanced',
    question: "What is the output of this decorator-like behavior?",
    code: "def outer(x):\n    def inner(y):\n        return x + y\n    return inner\n\nadd_five = outer(5)\nprint(add_five(10))",
    options: ["5", "10", "15", "Error"],
    correctAnswer: 2,
    explanation: "This is a closure. 'outer(5)' returns the 'inner' function with x=5. Calling 'add_five(10)' then returns 5 + 10."
  },
  {
    id: 8,
    difficulty: 'Advanced',
    question: "What is the purpose of '__init__.py' in a directory?",
    options: ["To initialize a variable", "To mark the directory as a Python package", "To run setup code for the OS", "It has no purpose in modern Python"],
    correctAnswer: 1,
    explanation: "While often empty, its presence tells Python that the directory should be treated as a package."
  },
  {
    id: 9,
    difficulty: 'Advanced',
    question: "Which of the following is true about Python's Global Interpreter Lock (GIL)?",
    options: ["It allows true multi-core parallel execution of threads", "It prevents multiple threads from executing Python bytecodes at once", "It is only present in Python 2", "It speeds up I/O bound tasks"],
    correctAnswer: 1,
    explanation: "The GIL is a mutex that protects access to Python objects, preventing multiple threads from executing Python bytecodes simultaneously."
  },
  {
    id: 10,
    difficulty: 'Advanced',
    question: "What is the output of this generator expression?",
    code: "gen = (x for x in range(3))\nprint(next(gen))\nprint(next(gen))",
    options: ["0 1", "1 2", "0 0", "Error"],
    correctAnswer: 0,
    explanation: "Generators yield values one at a time. The first next() gives 0, the second gives 1."
  }
];
