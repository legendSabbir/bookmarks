import plugin from '../plugin.json';
import styles from './style.scss';
const prompt = acode.require('prompt');
const confirm = acode.require('confirm');
const EditorFile = acode.require('EditorFile');
const fs = acode.require('fsOperation');
const { editor } = editorManager

if (window.acode) {
  acode.setPluginInit(plugin.id, main);
  acode.setPluginUnmount(plugin.id, destroy);
}

/**
 * Warning Unreadable code ahead 🗿
 * Read At your own risk 😷
 **/

const style = <style id="bookmarks-styles">{styles}</style>;
const bookmarkPanel = tag("section", { className: "bookmark-container" })
const bookmarkOverlay = tag("div", { className: "bookmark-overlay" })

bookmarkPanel.innerHTML = `
  <div class="bookmark-container-top">
    <div>
      <button class="add-btn" data-action="add">+</button>
      <button class="clear-all-btn" data-action="clear-all">Clear All</button>
    </div>
    <button class="close-btn" data-action="close"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-2 -2 24 24"><path fill="currentColor" d="m11.414 10l2.829-2.828a1 1 0 1 0-1.415-1.415L10 8.586L7.172 5.757a1 1 0 0 0-1.415 1.415L8.586 10l-2.829 2.828a1 1 0 0 0 1.415 1.415L10 11.414l2.828 2.829a1 1 0 0 0 1.415-1.415L11.414 10zM10 20C4.477 20 0 15.523 0 10S4.477 0 10 0s10 4.477 10 10s-4.477 10-10 10z"/></svg></button>
  </div>
  <ul class="bookmarks-list"></ul>
`;
const bookmarksList = bookmarkPanel.querySelector(".bookmarks-list")


/**
 * Execution starts here
 */
 
function main() {
  editor.commands.addCommand({
    name: "showBookmark",
    description: "Show Bookmark Panel",
    bindKey: { win: "Ctrl-b" },
    exec: () => {
      toggleBookmarkPanel();
      checkDeletedFile();
    },
  });
  
  document.head.append(style)
  
  // on app load restores previous bookmarks
  const savedBookmarks = JSON.parse(localStorage.getItem("bookmarks")) || []
  const len = savedBookmarks.length
  if (len > 0) {
    for (let i = 0; i < len; i++) {
      const bookmark = render(savedBookmarks[i])
      bookmarksList.insertAdjacentHTML("beforeend", bookmark)
    }
  }
  
  editor.textInput.getElement().addEventListener("keydown", (e) => {
    if (e.ctrlKey && +e.key.search(/[1-9]/) > -1) {
      const allBookMarkItems = bookmarksList.querySelectorAll("li")
      const len = allBookMarkItems.length
      if (len > 0) {
        gotoBookmark(allBookMarkItems[+e.key - 1].dataset)
      }
    }
  })
}


/**
 * Adding necessary events
 **/

bookmarkPanel.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]")
  if (!target) return
  switch(target.dataset.action) {
    case "close":
      toggleBookmarkPanel()
      return
    case "goto-mark":
      toggleBookmarkPanel()
      gotoBookmark(target.dataset);
      return
    case "add":
      addBookmark()
      return
    case "clear-all":
      clearAllBookmark();
      return
    case "edit":
      editBookmark(target.parentElement.parentElement);
      return
    case "delete":
      deleteBookmark(target.parentElement.parentElement)
      return
  }
})


/**
 * Some Util functions
 */

function getFormattedPath() {
  let path = editorManager.activeFile?.location
  if (!path) {
    window.toast("Unsaved file", 3000)
    return false
  }
  if (path.search(/com\.termux/) > -1) {
    path = path.split("::").pop()
  } else if (path.search(/file:\/\/\//) > -1) {
    path = path.split("///").pop()
  }
  return path
}

async function readUserInput() {
  const options = {
  required: true,
  placeholder: 'e.g. Bookmark1',
};

  const userInput = await prompt('Enter a Bookmark Title', '', 'text', options);
  return userInput
}

function render({ uri, row, column, filename, title, path }) {
  return `
    <li class="bookmark-item" data-action="goto-mark" 
      data-uri="${uri}"
      data-path="${path}"
      data-title="${title}"
      data-filename="${filename}"
      data-row="${row}"
      data-column="${column}"
    >
      <div class="meta-info">
        <h3 class="title">${title}</h3>
        <p class="line-info">Line: <span>${+row + 1}</span></p>
        <p class="path">${path}<span>${filename}</span></p>
      </div>
      
      <div class="action-container">
        <button class="edit-btn" data-action="edit"></button>
        <button class="delete-btn" data-action="delete"></button>
      </div>
    </li>
  `
}

async function getFormattedHtml() {
  const path = getFormattedPath();
  if (!path) return false;
  
  const title = await readUserInput();
  if (!title) return false;
  
  const { row, column } = editor.getCursorPosition();
  const { filename, uri } = editorManager.activeFile;
  
  const formattedHtml = render({ path, row, column, filename, uri, title });
  return formattedHtml
}



/**
 * Add new Bookmark
 **/

async function addBookmark() {
  const bookmarkItem = await getFormattedHtml()
  if (!bookmarkItem) return 
  bookmarksList.insertAdjacentHTML("beforeend", bookmarkItem);
  bookmarksList.scrollTop = bookmarksList.scrollHeight
  setTimeout(() => bookmarksList.lastElementChild.classList.add("active"), 300)
  setTimeout(() => bookmarksList.lastElementChild.classList.remove("active"), 800)
  updateLocalStorage()
}


/**
 * Edit BookMark
 **/

async function editBookmark(target) {
  const editedItem = await getFormattedHtml()
  if (!editedItem) return 
  target.insertAdjacentHTML("beforebegin", editedItem);
  target.remove();
  updateLocalStorage()
}


/**
 * Delete Bookmark
 **/

async function deleteBookmark(target) {
  let confirmation = await confirm('Delete Bookmark', 'Are you sure?');
  if (confirmation) {
    target.remove()
    updateLocalStorage()
  }
}



/**
 * Clear All Bookmarks
 **/
 
async function clearAllBookmark() {
  let confirmation = await confirm('Clear All Bookmarks', 'Are you sure?');
  if (confirmation) {
    bookmarksList.innerHTML = ""
    updateLocalStorage()
  }
}


/**
 * Goto Bookmark
 **/

function gotoBookmark({ row, column, filename, uri }) {
  let file = editorManager.getFile(uri, "uri")
  
  if (file) {
    file.makeActive()
  } else {
    file = new EditorFile(filename, { uri })
  }
  
  if (file.loaded) {
    editor.gotoLine(+row + 1, +column, true)
    editor.focus();
  } else {
    file.on("loadend", loadend)
    function loadend() {
      file.render();
      editor.gotoLine(+row + 1, +column, true);
      setTimeout(() => editor.focus(), 200)
      file.off("loadend", loadend);
    }
  }
}


/**
 * Check Deleted File
 **/ 

async function checkDeletedFile() {
  const bookmarkItems = bookmarksList.querySelectorAll("li") || []
  const len = bookmarkItems.length
  if (len <= 0) return
  for (let i = 0; i < len; i++) {
    const uri = bookmarkItems[i].dataset.uri
    const isExists = await fs(uri).exists()
    if (!isExists) {
      bookmarkItems[i].remove()
      updateLocalStorage()
    }
  }
}



/**
 * Update LocalStorage
 **/

function updateLocalStorage() {
  const bookmarks = []
  const bookmarkItems = bookmarksList.querySelectorAll("li")
  const len = bookmarkItems.length
  if (len > 0) {
    for (let i = 0; i < len; i++) {
      const { row, column, uri, filename, path, title } = bookmarkItems[i].dataset
      bookmarks.push({row, column, uri, filename, path, title })
    }
  }
  localStorage.setItem("bookmarks", JSON.stringify(bookmarks))
}


/**
 * Toggle bookmarkPanel 
 **/
bookmarkOverlay.addEventListener("click", toggleBookmarkPanel)
let isBookmarkPanelOpen = false

function toggleBookmarkPanel() {
  if (!isBookmarkPanelOpen) {
    document.body.append(bookmarkPanel, bookmarkOverlay)
    editor.blur()
    // setTimeout to overwrite focus added after click on command pallette
    setTimeout(() => editor.blur(), 200)
    isBookmarkPanelOpen = true
  } else {
    bookmarkPanel.remove()
    bookmarkOverlay.remove()
    editor.focus()
    isBookmarkPanelOpen = false
  }
}


/**
 * On Plugin uninstall
 */
 
function destroy() {
  style.remove()
  bookmarkOverlay.remove()
  bookmarkPanel.remove()
  editor.commands.removeCommand("showBookmark")
  localStorage.removeItem("bookmarks");
}