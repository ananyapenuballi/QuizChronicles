// Coding tasks run in the browser only. No code is sent to the server for execution.
export const codingTasks = [
  {
    id: "sum-array",
    title: "Sum an array",
    description: "Write a function named sumArray that takes an array of numbers and returns their sum. An empty array should return 0.",
    starter: "function sumArray(numbers) {\n  // Write your code here\n  return 0;\n}",
    tests: [
      { input: [1, 2, 3], expected: 6 },
      { input: [10, -2, 5], expected: 13 },
      { input: [], expected: 0 },
    ],
  },
  {
    id: "reverse-string",
    title: "Reverse a string",
    description: "Write a function named reverseString that takes a string and returns it reversed.",
    starter: "function reverseString(text) {\n  // Write your code here\n  return text;\n}",
    tests: [
      { input: "hello", expected: "olleh" },
      { input: "Quiz", expected: "ziuQ" },
      { input: "", expected: "" },
    ],
  },
  {
    id: "is-palindrome",
    title: "Check a palindrome",
    description: "Write a function named isPalindrome that returns true when the given string reads the same forwards and backwards, ignoring case. Otherwise return false.",
    starter: "function isPalindrome(text) {\n  // Write your code here\n  return false;\n}",
    tests: [
      { input: "Racecar", expected: true },
      { input: "hello", expected: false },
      { input: "Level", expected: true },
    ],
  },
];

export function runCodingTests(task, code) {
  const results = [];
  for (const test of task.tests) {
    try {
      const fn = new Function(`${code}; return ${taskFunctionName(task)};`)();
      if (typeof fn !== "function") {
        results.push({ input: test.input, expected: test.expected, got: "No function found", passed: false });
        continue;
      }
      const got = fn(test.input);
      results.push({ input: test.input, expected: test.expected, got, passed: JSON.stringify(got) === JSON.stringify(test.expected) });
    } catch (err) {
      results.push({ input: test.input, expected: test.expected, got: err.message, passed: false });
    }
  }
  return results;
}

function taskFunctionName(task) {
  if (task.id === "sum-array") return "sumArray";
  if (task.id === "reverse-string") return "reverseString";
  return "isPalindrome";
}
