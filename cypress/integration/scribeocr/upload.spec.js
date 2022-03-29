//Please replace httpServer with the correct address for your testing server or an environment variable
const httpServer = 'http://192.168.50.10:8080';

describe('Does it upload', () => {
  beforeEach(() => {
    cy.visit(httpServer);
  })
  it('loads', () => {
    cy.get('#navbar').should('not.be.empty')
  })
  it('a jpeg with hOCR?', () => {
    // We use the `cy.get()` command to get all elements that match the selector.
    // Then, we use `should` to assert that there are two matched items,
    // which are the two default items.
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').click()

    // We can go even further and check that the default todos each contain
    // the correct text. We use the `first` and `last` functions
    // to get just the first and last matched elements individually,
    // and then perform an assertion with `should`.
    // cy.get('.todo-list li').first().should('have.text', 'Pay electric bill')
    // cy.get('.todo-list li').last().should('have.text', 'Walk the dog')
  })
})