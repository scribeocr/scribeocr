//Please replace httpServer with the correct address for your testing server or an environment variable
const httpServer = 'http://192.168.50.10:8080';

describe('Upload', () => {
  beforeEach(() => {
    cy.visit(httpServer);
  })
  it('loads', () => {
    cy.get('#navbar').should('not.be.empty')
  })
  it('a jpeg with hOCR', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(['cypress/fixtures/jpeg_hocr/snow_drops.hocr', 'cypress/fixtures/jpeg_hocr/snow_drops.jpg'])
    cy.get('#nav-view-tab').click()
    cy.get('#importProgress').should('be.visible')
    
  })
  it('a png with hOCR', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(['cypress/fixtures/png_hocr/pretty_faces.hocr', 'cypress/fixtures/png_hocr/pretty_faces.png'])
    cy.get('#nav-view-tab').click()
    cy.get('#importProgress').should('be.visible')
  })
  it('a pdf with xml', () => {
    cy.get('#nav-import-tab').click()
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/pdf_xml/poeticalworksofm02priouoft_abbyy.xml', 
      'cypress/fixtures/pdf_xml/poeticalworksofm02priouoft_bw.pdf']
    )
    cy.get('#nav-view-tab').click()
    cy.get('#nav-import-tab').click()
    cy.get('#importProgress').should('be.visible')
  })
  
})