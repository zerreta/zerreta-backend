// Function to simulate Python for loop execution
function simulatePythonForLoop(code) {
  // Example: a=5, for i in range(a): print(i)
  
  // Extract variable assignment (like a=5)
  let rangeValue = 5; // Default fallback
  const assignMatch = code.match(/(\w+)\s*=\s*(\d+)/);
  if (assignMatch && assignMatch.length >= 3) {
    const varName = assignMatch[1];
    const varValue = parseInt(assignMatch[2]);
    rangeValue = varValue;
  }
  
  // Check if there's a for loop with range
  const hasForLoop = code.includes('for') && 
                    code.includes('in range') && 
                    code.includes(':');
  
  if (hasForLoop) {
    // Check if we're printing the loop variable
    const hasPrintLoopVar = code.includes('print(i)') || 
                           code.includes('print( i )') ||
                           code.includes('print(j)');
    
    if (hasPrintLoopVar) {
      // Simulate the output
      let output = '';
      for (let i = 0; i < rangeValue; i++) {
        output += i + '\n';
      }
      return output;
    }
  }
  
  return null; // No match for our pattern
}

// Test the function
const testCode = `a=5
for i in range(a):
    print(i)`;

console.log(simulatePythonForLoop(testCode)); 