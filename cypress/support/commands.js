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
    cy.get('#recognize-recognize-progress-collapse .progress-bar', { timeout: 60000 }).should(($el) => {
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


// Cypress.Commands.add('waitImport', () => {
//     cy.get('#recognize-recognize-progress-collapse .progress-bar').should(($el) => {
//         cy.wrap($el).invoke('attr', 'aria-valuenow').then(currentValue => {
//             cy.wrap($el).invoke('attr', 'aria-valuemax').then(maxValue => {
//                 console.log(`Current value: ${currentValue}; Max value: ${maxValue}`);
//                 expect(currentValue).to.equal(maxValue);
//             });
//         });
//     });
// })
