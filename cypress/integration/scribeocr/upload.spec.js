//Please replace httpServer with the correct address for your testing server or an environment variable
//const httpServer = 'http://192.168.50.10:8080';
const httpServer = 'https://scribeocr.com/';

describe('Upload', () => {
  beforeEach(() => {
    cy.visit(httpServer);
  })
  it('loads', () => {
    cy.get('#navbar').should('not.be.empty')
  })
  it('a jpeg with hOCR', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(['cypress/fixtures/snow_drops.hocr', 'cypress/fixtures/snow_drops.jpg'])
    cy.get('#pageCount').should('have.text', '1')
    cy.get('#importProgress').should('be.visible')
    
  })
  it('a png with hOCR', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.hocr', 'cypress/fixtures/pretty_faces.png'])
    cy.get('#importProgress').should('be.visible')
    cy.get('#pageCount').should('have.text', '1')
  })
  it('a pdf with xml', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 
      'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf']
    )
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '118')
    cy.get('#importProgress').should('be.visible')
  })
})