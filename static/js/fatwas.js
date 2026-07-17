(function() {
  const IFRAME_IDS = [
    'plot-sfi-manhattan',
    'plot-sfi-volcano',
    'plot-vfi-manhattan',
    'plot-vfi-volcano',
    'plot-sfd-manhattan',
    'plot-sfd-volcano',
    'plot-vfd-manhattan',
    'plot-vfd-volcano',
    'plot-overall'
  ];
  const GITHUB_REPO = 'atesfet/fatwas.io';

  let rawRows = [];
  let table = null;
  let selectedPhenotype = null;
  let pendingImageRequests = {};

  function initNavbar() {
    $('.navbar-burger').click(function() {
      $('.navbar-burger').toggleClass('is-active');
      $('.navbar-menu').toggleClass('is-active');
    });
  }

  function esc(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePhenotype(value) {
    const s = String(value || '').trim();
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      const parts = s.split('.');
      let intPart = parts[0].replace(/^0+(?=\d)/, '');
      if (!intPart) {
        intPart = '0';
      }
      if (parts.length === 1) {
        return intPart;
      }
      const fracPart = parts[1].replace(/0+$/, '');
      return fracPart ? (intPart + '.' + fracPart) : intPart;
    }
    return s;
  }

  function renderTableRows(rows) {
    const tbody = document.getElementById('associationTableBody');
    if (!tbody) {
      return;
    }

    const html = rows.map(function(r) {
      const pheno = esc(r.phenotype);
      return '<tr>' +
        '<td><button class=\"button is-small is-link is-light focus-select-btn\" data-phenotype=\"' + pheno + '\" type=\"button\">Focus</button></td>' +
        '<td>' + esc(r.phenotype) + '</td>' +
        '<td>' + esc(r.description) + '</td>' +
        '<td>' + esc(r.group) + '</td>' +
        '<td>' + esc(r.metric) + '</td>' +
        '<td>' + esc(r.bonf_pval) + '</td>' +
        '<td>' + esc(r.OR_CI) + '</td>' +
        '<td>' + esc(r.n_total) + '</td>' +
        '<td>' + esc(r.n_cases) + '</td>' +
        '<td>' + esc(r.n_controls) + '</td>' +
      '</tr>';
    }).join('');

    tbody.innerHTML = html;
  }

  function phenotypeRows(phenotype) {
    const key = normalizePhenotype(phenotype);
    return rawRows.filter(function(r) {
      return normalizePhenotype(r.phenotype) === key;
    });
  }

  function renderFocusInfo() {
    const label = document.getElementById('focusPhenotypeLabel');
    const details = document.getElementById('focusPhenotypeDetails');
    const pdfButton = document.getElementById('downloadFocusPdfButton');
    const discussionButton = document.getElementById('openFocusDiscussionButton');

    if (!label || !details || !pdfButton || !discussionButton) {
      return;
    }

    if (!selectedPhenotype) {
      label.textContent = 'None selected';
      details.textContent = 'Click any association row to activate cross-plot phenotype focus.';
      pdfButton.disabled = true;
      discussionButton.disabled = true;
      return;
    }

    const rows = phenotypeRows(selectedPhenotype);
    const desc = rows.length > 0 ? rows[0].description : '';
    const markers = Array.from(new Set(rows.map(function(r) { return r.metric; }))).join(', ');

    label.textContent = selectedPhenotype + (desc ? ' - ' + desc : '');
    details.textContent = rows.length + ' associated row(s) across marker(s): ' + markers;
    pdfButton.disabled = rows.length === 0;
    discussionButton.disabled = rows.length === 0;
  }

  function sendFocusToPlots() {
    IFRAME_IDS.forEach(function(id) {
      const frame = document.getElementById(id);
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({
          type: 'focusPhenotype',
          phenotype: selectedPhenotype || ''
        }, '*');
      }
    });
  }

  function setFocusPhenotype(phenotype) {
    const value = normalizePhenotype(phenotype);
    selectedPhenotype = value || null;
    renderFocusInfo();
    sendFocusToPlots();
    if (table) {
      table.draw(false);
    }
  }

  function initDataTable() {
    table = $('#mainTable').DataTable({
      orderCellsTop: true,
      pageLength: 25,
      order: [[5, 'asc']],
      columnDefs: [
        { targets: 0, orderable: false, searchable: false, width: '72px' }
      ],
      rowCallback: function(row, data) {
        const isFocused = selectedPhenotype && normalizePhenotype(data[1]) === selectedPhenotype;
        $(row).toggleClass('focus-row', Boolean(isFocused));
      }
    });

    $('#mainTable thead tr:eq(1) th').each(function(i) {
      const input = $('input', this);
      if (input.length) {
        input.on('keyup change', function() {
          if (table.column(i).search() !== this.value) {
            table.column(i).search(this.value).draw();
          }
        });
      }
    });

    $('#mainTable tbody').on('click', '.focus-select-btn', function(event) {
      event.preventDefault();
      event.stopPropagation();
      const phenotype = this.getAttribute('data-phenotype') || '';
      setFocusPhenotype(phenotype);
    });

    $('#mainTable tbody').on('click', 'tr', function() {
      const rowData = table.row(this).data();
      if (!rowData || !rowData.length) {
        return;
      }
      setFocusPhenotype(rowData[1]);
    });
  }

  function nextRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(16).slice(2);
  }

  function cleanTextForFilename(value) {
    return String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function buildFocusPdfFileName(phenotype, rows) {
    const codeOnly = String(phenotype || '').trim().split(' - ')[0].trim();
    const description = (rows && rows.length ? rows[0].description : '') || '';

    const safeCode = cleanTextForFilename(codeOnly) || 'phenotype';
    const safeDescription = cleanTextForFilename(description);
    const base = safeDescription ? ('fatwas_focus_' + safeCode + '_' + safeDescription) : ('fatwas_focus_' + safeCode);
    const trimmed = base.slice(0, 160).replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return (trimmed || 'fatwas_focus_phenotype') + '.pdf';
  }

  function metricFromIframeId(iframeId) {
    if (iframeId.indexOf('plot-sfi-') === 0) {
      return 'SFI';
    }
    if (iframeId.indexOf('plot-vfi-') === 0) {
      return 'VFI';
    }
    if (iframeId.indexOf('plot-sfd-') === 0) {
      return 'SFD';
    }
    if (iframeId.indexOf('plot-vfd-') === 0) {
      return 'VFD';
    }
    return '';
  }

  function openFocusDiscussion() {
    if (!selectedPhenotype) {
      return;
    }
    const title = 'Phenotype ' + selectedPhenotype + ' discussion';
    const searchQuery = 'is:issue repo:' + GITHUB_REPO + ' in:title \"' + title + '\"';
    const url = 'https://github.com/' + GITHUB_REPO + '/issues?q=' + encodeURIComponent(searchQuery);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function requestPlotImage(iframeId, timeoutMs) {
    return new Promise(function(resolve) {
      const frame = document.getElementById(iframeId);
      if (!frame || !frame.contentWindow) {
        resolve({ iframeId: iframeId, ok: false, reason: 'iframe missing' });
        return;
      }

      const requestId = nextRequestId();
      const timer = setTimeout(function() {
        delete pendingImageRequests[requestId];
        resolve({ iframeId: iframeId, ok: false, reason: 'timeout' });
      }, timeoutMs || 8000);

      pendingImageRequests[requestId] = function(payload) {
        clearTimeout(timer);
        resolve({ iframeId: iframeId, ok: true, payload: payload });
      };

      frame.contentWindow.postMessage({
        type: 'exportImage',
        requestId: requestId,
        phenotype: selectedPhenotype || ''
      }, '*');
    });
  }

  async function downloadFocusPdf() {
    if (!selectedPhenotype) {
      return;
    }

    const rows = phenotypeRows(selectedPhenotype);
    if (!rows.length) {
      return;
    }

    const button = document.getElementById('downloadFocusPdfButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Building PDF...';
    }

    try {
      const images = [];
      const associatedMetrics = new Set(rows.map(function(r) { return r.metric; }));
      const exportIframeIds = IFRAME_IDS.filter(function(id) {
        if (id === 'plot-overall') {
          return true;
        }
        const metric = metricFromIframeId(id);
        return metric && associatedMetrics.has(metric);
      });

      for (const id of exportIframeIds) {
        const result = await requestPlotImage(id, 10000);
        if (result.ok && result.payload && result.payload.dataUrl) {
          images.push(result.payload);
        }
      }

      const jsPdfNs = window.jspdf;
      if (!jsPdfNs || !jsPdfNs.jsPDF) {
        throw new Error('jsPDF not loaded');
      }

      const doc = new jsPdfNs.jsPDF('p', 'pt', 'letter');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 36;
      const usableW = pageW - margin * 2;

      doc.setFontSize(14);
      doc.text('FatWAS Focus Report', margin, margin);
      doc.setFontSize(11);
      doc.text('Phenotype: ' + selectedPhenotype, margin, margin + 20);

      const bodyRows = rows.map(function(r) {
        return [
          r.metric,
          r.group,
          r.bonf_pval,
          r.OR_CI,
          r.n_cases,
          r.n_controls
        ];
      });

      doc.autoTable({
        startY: margin + 34,
        head: [['Metric', 'Group', 'Adj P', 'OR (95% CI)', 'Cases', 'Controls']],
        body: bodyRows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 77, 110] }
      });

      images.forEach(function(img) {
        doc.addPage('letter', 'landscape');

        const pW = doc.internal.pageSize.getWidth();
        const pH = doc.internal.pageSize.getHeight();
        const pMargin = 24;
        const titleGap = 16;
        const areaW = pW - pMargin * 2;
        const areaH = pH - pMargin * 2 - titleGap;

        const srcW = Number(img.width) || 2200;
        const srcH = Number(img.height) || 1300;
        const ratio = srcW / srcH;

        let drawW = areaW;
        let drawH = drawW / ratio;
        if (drawH > areaH) {
          drawH = areaH;
          drawW = drawH * ratio;
        }

        const x = (pW - drawW) / 2;
        const y = pMargin + titleGap + ((areaH - drawH) / 2);

        doc.setFontSize(10);
        doc.text(img.title || img.plotId || 'Plot', pMargin, pMargin + 8);
        doc.addImage(img.dataUrl, 'PNG', x, y, drawW, drawH);
      });

      const fileName = buildFocusPdfFileName(selectedPhenotype, rows);
      doc.save(fileName);
    } catch (err) {
      console.error(err);
      alert('Could not build focus PDF. Check browser console for details.');
    } finally {
      if (button) {
        button.disabled = !selectedPhenotype;
        button.textContent = 'Download Focus PDF';
      }
    }
  }

  function initAssociationsTable() {
    Papa.parse('significant_associations.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        rawRows = results.data.map(function(r) {
          return {
            phenotype: normalizePhenotype(r.phenotype),
            description: r.description || '',
            group: r.group || '',
            metric: r.metric || '',
            bonf_pval: r.bonf_pval || '',
            OR_CI: r.OR_CI || '',
            n_total: r.n_total || '',
            n_cases: r.n_cases || '',
            n_controls: r.n_controls || ''
          };
        });

        renderTableRows(rawRows);
        initDataTable();
        renderFocusInfo();
      },
      error: function(err) {
        console.error('Could not load significant_associations.csv', err);
      }
    });
  }

  function initControls() {
    const clearBtn = document.getElementById('clearFocusButton');
    const pdfBtn = document.getElementById('downloadFocusPdfButton');
    const discussionBtn = document.getElementById('openFocusDiscussionButton');

    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        setFocusPhenotype('');
      });
    }

    if (pdfBtn) {
      pdfBtn.addEventListener('click', downloadFocusPdf);
    }

    if (discussionBtn) {
      discussionBtn.addEventListener('click', openFocusDiscussion);
    }
  }

  window.addEventListener('message', function(event) {
    const msg = event.data || {};
    if (msg.type === 'exportImageResult' && msg.requestId && pendingImageRequests[msg.requestId]) {
      const cb = pendingImageRequests[msg.requestId];
      delete pendingImageRequests[msg.requestId];
      cb(msg);
    }
  });

  $(document).ready(function() {
    initNavbar();
    initControls();
    initAssociationsTable();
  });
})();
