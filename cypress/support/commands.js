// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
require('cy-verify-downloads').addCustomCommand();

// Wait for recognition to finish running
Cypress.Commands.add('waitRecognizeAll', () => {
    cy.get('#recognize-recognize-progress-collapse .progress-bar').should(($el) => {
        const currentValue = $el.attr('aria-valuenow');
        const maxValue = $el.attr('aria-valuemax');
        expect(currentValue).to.equal(maxValue);
    });
})

// Wait for import to finish running
Cypress.Commands.add('waitImport', () => {
    cy.get('#import-progress-collapse .progress-bar').should(($el) => {
        const currentValue = $el.attr('aria-valuenow');
        const maxValue = $el.attr('aria-valuemax');
        expect(currentValue).to.equal(maxValue);
    });
})

Cypress.Commands.add('downloadAllFormats', (basename) => {
    // Download text
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload(basename + '.txt')

    // Download .hocr
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload(basename + '.hocr')

    // Download .docx
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionDocx').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload(basename + '.docx')

    // Download .pdf
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.wait(250)
    cy.get('#download').click()
    cy.verifyDownload(basename + '.pdf')
})