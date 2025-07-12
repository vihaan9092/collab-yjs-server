/**
 * DocumentGenerator Class - Creates realistic document content for testing
 * Generates authentic business documents with proper structure and content
 */

class DocumentGenerator {
  constructor() {
    this.documentTypes = ['report', 'proposal', 'meeting_notes', 'specification', 'manual'];
    this.contentLibrary = this.initializeContentLibrary();
  }

  /**
   * Initialize realistic content library
   */
  initializeContentLibrary() {
    return {
      titles: {
        report: [
          'Q4 2024 Performance Analysis Report',
          'Customer Satisfaction Survey Results',
          'Market Research Findings',
          'Product Development Status Report',
          'Financial Performance Review'
        ],
        proposal: [
          'New Product Launch Strategy',
          'Digital Transformation Initiative',
          'Cost Optimization Proposal',
          'Partnership Agreement Framework',
          'Technology Upgrade Plan'
        ],
        meeting_notes: [
          'Weekly Team Standup - Engineering',
          'Product Planning Session',
          'Client Requirements Review',
          'Budget Planning Meeting',
          'Strategic Planning Workshop'
        ],
        specification: [
          'API Integration Specification',
          'User Interface Design Guidelines',
          'Database Schema Documentation',
          'Security Requirements Specification',
          'Performance Testing Criteria'
        ],
        manual: [
          'Employee Onboarding Guide',
          'Software Installation Manual',
          'Quality Assurance Procedures',
          'Emergency Response Protocol',
          'Data Backup and Recovery Guide'
        ]
      },
      
      sections: {
        executive_summary: [
          'This document provides a comprehensive overview of our current initiatives and their impact on business objectives.',
          'The following analysis presents key findings from our recent evaluation of market conditions and competitive landscape.',
          'Our team has conducted extensive research to identify opportunities for growth and operational improvement.'
        ],
        introduction: [
          'In today\'s rapidly evolving business environment, organizations must adapt quickly to changing market conditions.',
          'This initiative represents a strategic investment in our company\'s future growth and sustainability.',
          'The purpose of this document is to outline our approach to addressing current challenges and opportunities.'
        ],
        methodology: [
          'Our analysis employed a multi-faceted approach combining quantitative data analysis with qualitative stakeholder interviews.',
          'Data collection was conducted over a six-month period using industry-standard research methodologies.',
          'We utilized advanced analytics tools to process large datasets and identify meaningful patterns and trends.'
        ],
        findings: [
          'The research revealed significant opportunities for process optimization and cost reduction.',
          'Customer feedback indicates strong demand for enhanced digital services and improved user experience.',
          'Market analysis shows favorable conditions for expansion into new geographic regions.'
        ],
        recommendations: [
          'We recommend implementing a phased approach to minimize risk while maximizing potential benefits.',
          'Investment in technology infrastructure will be critical to supporting future growth initiatives.',
          'Regular monitoring and evaluation will ensure that objectives are met and adjustments can be made as needed.'
        ]
      },
      
      paragraphs: [
        'The implementation of new technologies has significantly improved our operational efficiency and customer satisfaction metrics. Our team has successfully deployed automated systems that reduce manual processing time by 40% while maintaining high quality standards.',
        'Market research indicates that customer preferences are shifting toward more personalized and responsive service offerings. This trend presents both challenges and opportunities for organizations willing to invest in customer-centric solutions.',
        'Financial analysis reveals strong performance across all key metrics, with revenue growth exceeding projections by 15%. This success can be attributed to strategic investments in product development and market expansion initiatives.',
        'The competitive landscape continues to evolve rapidly, with new entrants bringing innovative solutions to market. Our response strategy focuses on leveraging our core strengths while developing new capabilities to maintain market leadership.',
        'Stakeholder feedback has been overwhelmingly positive, with particular praise for our commitment to quality and customer service. These results validate our strategic approach and provide confidence for future investments.',
        'Risk assessment procedures have identified several areas requiring immediate attention to ensure compliance with regulatory requirements. Our mitigation strategy includes enhanced monitoring systems and staff training programs.',
        'Technology infrastructure upgrades have been completed on schedule and within budget, providing the foundation for future growth initiatives. The new systems offer improved scalability, security, and performance characteristics.',
        'Customer acquisition costs have decreased by 25% following the implementation of targeted marketing campaigns and improved conversion processes. This efficiency gain allows for increased investment in product development and customer retention programs.',
        'Supply chain optimization efforts have resulted in reduced lead times and improved inventory management. These improvements contribute directly to customer satisfaction and operational cost reduction.',
        'Employee engagement surveys indicate high levels of satisfaction with recent organizational changes and professional development opportunities. This positive feedback supports our human resources strategy and retention goals.'
      ],
      
      tableData: {
        financial: [
          ['Quarter', 'Revenue', 'Expenses', 'Profit Margin'],
          ['Q1 2024', '$2.4M', '$1.8M', '25%'],
          ['Q2 2024', '$2.7M', '$1.9M', '30%'],
          ['Q3 2024', '$3.1M', '$2.1M', '32%'],
          ['Q4 2024', '$3.5M', '$2.3M', '34%']
        ],
        performance: [
          ['Metric', 'Target', 'Actual', 'Variance'],
          ['Customer Satisfaction', '85%', '92%', '+7%'],
          ['Response Time', '< 2 hours', '1.3 hours', '+35%'],
          ['Error Rate', '< 1%', '0.3%', '+70%'],
          ['Uptime', '99.5%', '99.8%', '+0.3%']
        ],
        resources: [
          ['Department', 'Headcount', 'Budget', 'Utilization'],
          ['Engineering', '45', '$4.2M', '94%'],
          ['Sales', '28', '$2.8M', '87%'],
          ['Marketing', '15', '$1.5M', '91%'],
          ['Operations', '32', '$2.1M', '89%']
        ]
      },
      
      listItems: [
        'Implement automated testing procedures to improve software quality',
        'Develop comprehensive training programs for new team members',
        'Establish regular communication channels with key stakeholders',
        'Create detailed documentation for all critical business processes',
        'Monitor key performance indicators and adjust strategies accordingly',
        'Invest in modern technology infrastructure to support growth',
        'Build strategic partnerships with industry-leading organizations',
        'Enhance customer support capabilities through additional staffing',
        'Conduct regular security audits to protect sensitive information',
        'Optimize workflow processes to reduce operational overhead'
      ]
    };
  }

  /**
   * Generate a complete realistic document
   */
  generateDocument(targetSize, documentType = null) {
    const type = documentType || this.getRandomDocumentType();
    const title = this.getRandomTitle(type);
    
    const document = {
      type: 'doc',
      content: []
    };

    // Add title
    document.content.push({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: title }]
    });

    // Add metadata section
    document.content.push(this.generateMetadataSection());

    // Add executive summary
    document.content.push(this.generateSection('Executive Summary', 'executive_summary'));

    // Add main content sections
    const sections = this.getSectionsForDocumentType(type);
    sections.forEach(section => {
      document.content.push(this.generateSection(section.title, section.type));
    });

    // Fill to target size with additional content
    this.fillToTargetSize(document, targetSize);

    return document;
  }

  /**
   * Generate metadata section with realistic information
   */
  generateMetadataSection() {
    const currentDate = new Date().toLocaleDateString();
    const authors = ['Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim'];
    const departments = ['Engineering', 'Product Management', 'Business Development', 'Operations'];
    
    return {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Document Information' }] }]
            },
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Details' }] }]
            }
          ]
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Date Created' }] }]
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: currentDate }] }]
            }
          ]
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Author' }] }]
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: authors[Math.floor(Math.random() * authors.length)] }] }]
            }
          ]
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Department' }] }]
            },
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: departments[Math.floor(Math.random() * departments.length)] }] }]
            }
          ]
        }
      ]
    };
  }

  /**
   * Generate a content section with realistic structure
   */
  generateSection(title, sectionType) {
    const section = [];
    
    // Section heading
    section.push({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: title }]
    });

    // Section introduction
    const introText = this.getRandomContent(sectionType) || this.getRandomParagraph();
    section.push({
      type: 'paragraph',
      content: [{ type: 'text', text: introText }]
    });

    // Add varied content based on section type
    if (Math.random() < 0.4) {
      section.push(this.generateBulletList());
    }

    if (Math.random() < 0.3) {
      section.push(this.generateDataTable());
    }

    // Add additional paragraphs
    const paragraphCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < paragraphCount; i++) {
      section.push({
        type: 'paragraph',
        content: [{ 
          type: 'text', 
          text: this.getRandomParagraph(),
          marks: this.getRandomTextMarks()
        }]
      });
    }

    return section;
  }

  /**
   * Generate realistic bullet list
   */
  generateBulletList() {
    const itemCount = 3 + Math.floor(Math.random() * 5);
    const listItems = [];
    
    for (let i = 0; i < itemCount; i++) {
      listItems.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: this.getRandomListItem() }]
        }]
      });
    }

    return {
      type: 'bulletList',
      content: listItems
    };
  }

  /**
   * Generate realistic data table
   */
  generateDataTable() {
    const tableTypes = ['financial', 'performance', 'resources'];
    const tableType = tableTypes[Math.floor(Math.random() * tableTypes.length)];
    const tableData = this.contentLibrary.tableData[tableType];
    
    const rows = tableData.map((rowData, index) => ({
      type: 'tableRow',
      content: rowData.map(cellData => ({
        type: index === 0 ? 'tableHeader' : 'tableCell',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: cellData }]
        }]
      }))
    }));

    return {
      type: 'table',
      content: rows
    };
  }

  /**
   * Fill document to target size
   */
  fillToTargetSize(document, targetSize) {
    let currentSize = JSON.stringify(document).length;
    
    while (currentSize < targetSize * 0.9) { // Leave 10% buffer
      // Add random content
      if (Math.random() < 0.6) {
        // Add paragraph
        document.content.push({
          type: 'paragraph',
          content: [{ 
            type: 'text', 
            text: this.getRandomParagraph(),
            marks: this.getRandomTextMarks()
          }]
        });
      } else if (Math.random() < 0.7) {
        // Add list
        document.content.push(this.generateBulletList());
      } else {
        // Add table
        document.content.push(this.generateDataTable());
      }
      
      currentSize = JSON.stringify(document).length;
      
      // Safety check
      if (document.content.length > 1000) break;
    }
  }

  /**
   * Get random document type
   */
  getRandomDocumentType() {
    return this.documentTypes[Math.floor(Math.random() * this.documentTypes.length)];
  }

  /**
   * Get random title for document type
   */
  getRandomTitle(type) {
    const titles = this.contentLibrary.titles[type] || this.contentLibrary.titles.report;
    return titles[Math.floor(Math.random() * titles.length)];
  }

  /**
   * Get sections for document type
   */
  getSectionsForDocumentType(type) {
    const sectionMaps = {
      report: [
        { title: 'Introduction', type: 'introduction' },
        { title: 'Methodology', type: 'methodology' },
        { title: 'Key Findings', type: 'findings' },
        { title: 'Recommendations', type: 'recommendations' }
      ],
      proposal: [
        { title: 'Project Overview', type: 'introduction' },
        { title: 'Proposed Solution', type: 'methodology' },
        { title: 'Expected Benefits', type: 'findings' },
        { title: 'Implementation Plan', type: 'recommendations' }
      ],
      meeting_notes: [
        { title: 'Attendees', type: 'introduction' },
        { title: 'Discussion Points', type: 'findings' },
        { title: 'Action Items', type: 'recommendations' }
      ],
      specification: [
        { title: 'Requirements', type: 'introduction' },
        { title: 'Technical Details', type: 'methodology' },
        { title: 'Implementation Notes', type: 'findings' }
      ],
      manual: [
        { title: 'Getting Started', type: 'introduction' },
        { title: 'Procedures', type: 'methodology' },
        { title: 'Troubleshooting', type: 'findings' }
      ]
    };
    
    return sectionMaps[type] || sectionMaps.report;
  }

  /**
   * Get random content for section type
   */
  getRandomContent(sectionType) {
    const content = this.contentLibrary.sections[sectionType];
    return content ? content[Math.floor(Math.random() * content.length)] : null;
  }

  /**
   * Get random paragraph
   */
  getRandomParagraph() {
    return this.contentLibrary.paragraphs[Math.floor(Math.random() * this.contentLibrary.paragraphs.length)];
  }

  /**
   * Get random list item
   */
  getRandomListItem() {
    return this.contentLibrary.listItems[Math.floor(Math.random() * this.contentLibrary.listItems.length)];
  }

  /**
   * Get random text formatting marks
   */
  getRandomTextMarks() {
    const marks = [];
    
    if (Math.random() < 0.1) marks.push({ type: 'bold' });
    if (Math.random() < 0.05) marks.push({ type: 'italic' });
    if (Math.random() < 0.02) marks.push({ type: 'underline' });
    
    return marks.length > 0 ? marks : undefined;
  }

  /**
   * Generate document summary for reporting
   */
  generateDocumentSummary(document) {
    const content = JSON.stringify(document);
    const size = content.length;
    
    // Count different content types
    const paragraphs = (content.match(/"type":"paragraph"/g) || []).length;
    const tables = (content.match(/"type":"table"/g) || []).length;
    const lists = (content.match(/"type":"bulletList"/g) || []).length;
    const headings = (content.match(/"type":"heading"/g) || []).length;
    
    return {
      size: size,
      sizeFormatted: `${(size / 1024 / 1024).toFixed(2)}MB`,
      contentTypes: {
        paragraphs,
        tables,
        lists,
        headings
      },
      estimatedWords: Math.floor(size / 6), // Rough estimate
      complexity: this.calculateComplexity(paragraphs, tables, lists, headings)
    };
  }

  /**
   * Calculate document complexity score
   */
  calculateComplexity(paragraphs, tables, lists, headings) {
    const score = (paragraphs * 1) + (tables * 3) + (lists * 2) + (headings * 1);
    
    if (score < 20) return 'Simple';
    if (score < 50) return 'Moderate';
    if (score < 100) return 'Complex';
    return 'Very Complex';
  }
}

module.exports = DocumentGenerator;
