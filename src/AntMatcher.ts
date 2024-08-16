export class AntPathMatcher {
  private static DEFAULT_PATH_SEPARATOR = '/';

  private readonly pathSeparator: string;

  constructor(pathSeparator: string = AntPathMatcher.DEFAULT_PATH_SEPARATOR) {
    this.pathSeparator = pathSeparator;
  }

  public match(pattern: string, path: string): boolean {
    return this.doMatch(pattern, path, true);
  }

  public isPattern(path: string): boolean {
    return path.indexOf('*') !== -1 || path.indexOf('?') !== -1;
  }

  public extractPathWithinPattern(pattern: string, path: string): string {
    const patternParts = this.tokenizeToStringArray(pattern, this.pathSeparator);
    const pathParts = this.tokenizeToStringArray(path, this.pathSeparator);

    let buffer = '';
    let patternStarted = false;

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      if (patternPart.indexOf('*') > -1 || patternPart.indexOf('?') > -1) {
        patternStarted = true;
      }
      if (patternStarted) {
        if (i < pathParts.length) {
          buffer += pathParts[i];
        }
        if (i < patternParts.length - 1) {
          buffer += this.pathSeparator;
        }
      }
    }

    return buffer;
  }

  private doMatch(pattern: string, path: string, fullMatch: boolean): boolean {
    const pattDirs = this.tokenizeToStringArray(pattern, this.pathSeparator);
    const pathDirs = this.tokenizeToStringArray(path, this.pathSeparator);

    let pattIdxStart = 0;
    let pattIdxEnd = pattDirs.length - 1;
    let pathIdxStart = 0;
    let pathIdxEnd = pathDirs.length - 1;

    // Match all elements up to the first **
    while (pattIdxStart <= pattIdxEnd && pathIdxStart <= pathIdxEnd) {
      const pattDir = pattDirs[pattIdxStart];
      if (pattDir === '**') {
        break;
      }
      if (!this.matchStrings(pattDir, pathDirs[pathIdxStart])) {
        return false;
      }
      pattIdxStart++;
      pathIdxStart++;
    }

    if (pathIdxStart > pathIdxEnd) {
      // Path is exhausted, only match if rest of pattern is * or **'s
      if (pattIdxStart > pattIdxEnd) {
        return pattern.endsWith(this.pathSeparator) ? path.endsWith(this.pathSeparator) : !path.endsWith(this.pathSeparator);
      }
      if (!fullMatch) {
        return true;
      }
      if (pattIdxStart === pattIdxEnd && pattDirs[pattIdxStart] === '*' && path.endsWith(this.pathSeparator)) {
        return true;
      }
      for (let i = pattIdxStart; i <= pattIdxEnd; i++) {
        if (pattDirs[i] !== '**') {
          return false;
        }
      }
      return true;
    } else if (pattIdxStart > pattIdxEnd) {
      // String not exhausted, but pattern is. Failure.
      return false;
    } else if (!fullMatch && '**' === pattDirs[pattIdxStart]) {
      // Path start definitely matches due to "**" part in pattern.
      return true;
    }

    // up to last '**'
    while (pattIdxStart <= pattIdxEnd && pathIdxStart <= pathIdxEnd) {
      const pattDir = pattDirs[pattIdxEnd];
      if (pattDir === '**') {
        break;
      }
      if (!this.matchStrings(pattDir, pathDirs[pathIdxEnd])) {
        return false;
      }
      pattIdxEnd--;
      pathIdxEnd--;
    }

    if (pathIdxStart > pathIdxEnd) {
      // String is exhausted
      for (let i = pattIdxStart; i <= pattIdxEnd; i++) {
        if (pattDirs[i] !== '**') {
          return false;
        }
      }
      return true;
    }

    while (pattIdxStart !== pattIdxEnd && pathIdxStart <= pathIdxEnd) {
      let patIdxTmp = -1;
      for (let i = pattIdxStart + 1; i <= pattIdxEnd; i++) {
        if (pattDirs[i] === '**') {
          patIdxTmp = i;
          break;
        }
      }
      if (patIdxTmp === pattIdxStart + 1) {
        // '**/**' situation, so skip one
        pattIdxStart++;
        continue;
      }
      // Find the pattern between pattIdxStart & patIdxTmp in str between
      // strIdxStart & strIdxEnd
      const patLength = (patIdxTmp - pattIdxStart - 1);
      const strLength = (pathIdxEnd - pathIdxStart + 1);
      let foundIdx = -1;

      strLoop:
        for (let i = 0; i <= strLength - patLength; i++) {
          for (let j = 0; j < patLength; j++) {
            const subPat = pattDirs[pattIdxStart + j + 1];
            const subStr = pathDirs[pathIdxStart + i + j];
            if (!this.matchStrings(subPat, subStr)) {
              continue strLoop;
            }
          }
          foundIdx = pathIdxStart + i;
          break;
        }

      if (foundIdx === -1) {
        return false;
      }

      pattIdxStart = patIdxTmp;
      pathIdxStart = foundIdx + patLength;
    }

    for (let i = pattIdxStart; i <= pattIdxEnd; i++) {
      if (pattDirs[i] !== '**') {
        return false;
      }
    }

    return true;
  }

  private matchStrings(pattern: string, str: string): boolean {
    const patArr = pattern.split('');
    const strArr = str.split('');
    let patIdxStart = 0;
    let patIdxEnd = patArr.length - 1;
    let strIdxStart = 0;
    let strIdxEnd = strArr.length - 1;

    let ch: string;

    let containsStar = false;
    for (const element of patArr) {
      if (element === '*') {
        containsStar = true;
        break;
      }
    }

    if (!containsStar) {
      // No '*'s, so we make a shortcut
      if (patIdxEnd !== strIdxEnd) {
        return false; // Pattern and string do not have the same size
      }
      for (let i = 0; i <= patIdxEnd; i++) {
        ch = patArr[i];
        if (ch !== '?') {
          if (ch !== strArr[i]) {
            return false; // Character mismatch
          }
        }
      }
      return true; // String matches against pattern
    }

    if (patIdxEnd === 0) {
      return true; // Pattern contains only '*', which matches anything
    }

    // Process characters before first star
    while ((ch = patArr[patIdxStart]) !== '*' && strIdxStart <= strIdxEnd) {
      if (ch !== '?') {
        if (ch !== strArr[strIdxStart]) {
          return false; // Character mismatch
        }
      }
      patIdxStart++;
      strIdxStart++;
    }
    if (strIdxStart > strIdxEnd) {
      // All characters in the string are used. Check if only '*'s are left in the pattern. If so, we succeeded. Otherwise, failure.
      for (let i = patIdxStart; i <= patIdxEnd; i++) {
        if (patArr[i] !== '*') {
          return false;
        }
      }
      return true;
    }

    // Process characters after last star
    while ((ch = patArr[patIdxEnd]) !== '*' && strIdxStart <= strIdxEnd) {
      if (ch !== '?') {
        if (ch !== strArr[strIdxEnd]) {
          return false; // Character mismatch
        }
      }
      patIdxEnd--;
      strIdxEnd--;
    }
    if (strIdxStart > strIdxEnd) {
      // All characters in the string are used. Check if only '*'s are left in the pattern. If so, we succeeded. Otherwise, failure.
      for (let i = patIdxStart; i <= patIdxEnd; i++) {
        if (patArr[i] !== '*') {
          return false;
        }
      }
      return true;
    }

    // Process pattern between stars. padIdxStart and patIdxEnd point to the first and last '*''s found.
    while (patIdxStart !== patIdxEnd && strIdxStart <= strIdxEnd) {
      let patIdxTmp = -1;
      for (let i = patIdxStart + 1; i <= patIdxEnd; i++) {
        if (patArr[i] === '*') {
          patIdxTmp = i;
          break;
        }
      }
      if (patIdxTmp === patIdxStart + 1) {
        // '**/**' situation, so skip one
        patIdxStart++;
        continue;
      }
      // Find the pattern between patIdxStart & patIdxTmp in str between strIdxStart & strIdxEnd
      const patLength = (patIdxTmp - patIdxStart - 1);
      const strLength = (strIdxEnd - strIdxStart + 1);
      let foundIdx = -1;

      strLoop:
        for (let i = 0; i <= strLength - patLength; i++) {
          for (let j = 0; j < patLength; j++) {
            ch = patArr[patIdxStart + j + 1];
            if (ch !== '?') {
              if (ch !== strArr[strIdxStart + i + j]) {
                continue strLoop;
              }
            }
          }
          foundIdx = strIdxStart + i;
          break;
        }

      if (foundIdx === -1) {
        return false;
      }

      patIdxStart = patIdxTmp;
      strIdxStart = foundIdx + patLength;
    }

    for (let i = patIdxStart; i <= patIdxEnd; i++) {
      if (patArr[i] !== '*') {
        return false;
      }
    }

    return true;
  }

  private tokenizeToStringArray(str: string, delimiter: string): string[] {
    return str.split(delimiter).filter(s => s.length > 0);
  }
}
