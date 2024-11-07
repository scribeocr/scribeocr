import { Modal } from '../lib/bootstrap.esm.bundle.min.js';

/**
 * Creates and displays a Bootstrap modal with the specified title, body content, and optional buttons.
 *
 * @param {string} title - The title of the modal.
 * @param {string} bodyContent - The main content of the modal body.
 * @param {Array<{ label: string, classes: string, onClick?: Function }>} [buttons] - Array of button configurations for the modal footer.
 */
export const createBootstrapModal = (title, bodyContent, buttons = []) => {
  // Create the modal structure
  const modalContainer = document.createElement('div');
  modalContainer.className = 'modal fade';
  modalContainer.tabIndex = -1;
  modalContainer.setAttribute('role', 'dialog');

  const modalDialog = document.createElement('div');
  modalDialog.className = 'modal-dialog';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // Modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';

  const modalTitle = document.createElement('h5');
  modalTitle.className = 'modal-title';
  modalTitle.textContent = title;

  const closeButton = document.createElement('button');
  closeButton.className = 'btn-close';
  closeButton.setAttribute('data-bs-dismiss', 'modal');
  closeButton.setAttribute('aria-label', 'Close');

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeButton);

  // Modal body
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  modalBody.innerHTML = bodyContent;

  // Modal footer
  const modalFooter = document.createElement('div');
  modalFooter.className = 'modal-footer';

  buttons.forEach(({ label, classes, onClick }) => {
    const button = document.createElement('button');
    button.className = `btn ${classes}`;
    button.textContent = label;

    // Attach event handler if provided
    if (onClick) {
      button.addEventListener('click', onClick);
    }

    // Dismiss modal for buttons with data-bs-dismiss attribute
    if (classes.includes('btn-secondary')) {
      button.setAttribute('data-bs-dismiss', 'modal');
    }

    modalFooter.appendChild(button);
  });

  // Append all parts to modal content
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);

  // Append modal dialog to modal container
  modalDialog.appendChild(modalContent);
  modalContainer.appendChild(modalDialog);

  // Append modal to body
  document.body.appendChild(modalContainer);

  // Initialize and show the modal using Bootstrap's Modal component
  const modal = new Modal(modalContainer);
  modal.show();

  // Clean up the modal from the DOM once it's hidden
  modalContainer.addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(modalContainer);
  });
};
