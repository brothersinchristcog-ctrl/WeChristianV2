const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replaceInFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace imports and usages
  content = content.replace(/DatabaseService/g, 'FirestoreService');
  content = content.replace(/SalesforceMember/g, 'AppMember');
  content = content.replace(/SalesforceVideo/g, 'FirestoreVideo');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
};

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = fs.statSync(dirFile).isDirectory()
        ? walkSync(dirFile, filelist)
        : filelist.concat(dirFile);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return;
      }
      throw err;
    }
  });
  return filelist;
};

const files = walkSync(directoryPath);
files.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
    replaceInFile(file);
  }
});

console.log('Refactoring complete.');
