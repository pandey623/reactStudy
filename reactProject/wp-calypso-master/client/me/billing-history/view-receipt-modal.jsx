/**
 * External dependencies
 */
var React = require( 'react' ),
	closest = require( 'component-closest' ),
	defer = require( 'lodash/function/defer' ),
	titleCase = require( 'to-title-case' );

/**
 * Internal dependencies
 */
var tableRows = require( './table-rows' ),
	observe = require( 'lib/mixins/data-observe' ),
	Overlay = require( 'components/overlay' ),
	eventRecorder = require( 'me/event-recorder' );

module.exports = React.createClass( {
	displayName: 'ViewReceiptModal',

	mixins: [ observe( 'billingData' ), eventRecorder ],

	render: function() {
		var transaction = this.props.transaction,
			secondary = {
				title: this.translate( 'Close' ),
				defaultBack: '/me/billing'
			};

		return (
			<div className="wp-overlay fade-background">
				<Overlay primary={ false } secondary={ secondary } hideSelectedSite={ true }>
					{ this.renderContent( transaction ) }
				</Overlay>
			</div>
		);
	},

	close: function() {
		defer( this.props.onClose );
	},

	closeOutside: function( event ) {
		if ( closest( event.target, '.nd-modal' ) && event.target.tagName !== 'A' ) {
			event.preventDefault();
		}

		this.close();
	},

	printReceipt: function( event ) {
		event.preventDefault();

		window.print();
	},

	renderContent: function( transaction ) {
		var title = this.translate( 'Visit %(url)s', { args: { url: transaction.url } } ),
			serviceLink = <a href={ transaction.url } title={ title }/>;

		return (
			<div className="view-receipt-wrapper">
				<div className="app-overview">
					<img src={ transaction.icon } title={ transaction.service } />
					<h2> {
						this.translate( '{{link}}%(service)s{{/link}} {{small}}by %(organization)s{{/small}}',
							{
								components: {
									link: serviceLink,
									small: <small/>
								},
								args: {
									service: transaction.service,
									organization: transaction.org,
								},
								comment: 'This string is "Service by Organization". The {{link}} and {{small}} add html styling and attributes. Screenshot: https://cloudup.com/isX-WEFYlOs'
							} )
						}
						<div className="transaction-date">{ tableRows.formatDate( transaction.date ) }</div>
					</h2>
				</div>

				<ul className="receipt-details group">
					<li>
						<strong>{ this.translate( 'Receipt ID' ) }</strong>
						<span>{ transaction.id }</span>
					</li>
					{ this.ref() }
					{ this.paymentMethod() }
					{ transaction.cc_num !== 'XXXX' ? this.renderBillingDetails( transaction ) : null }
				</ul>

				{ this.renderLineItems( transaction ) }

				<div className="receipt-links">
					<a href={ transaction.support } className="button is-primary" onClick={ this.recordClickEvent( 'Contact {appName} Support in Billing History Receipt' ) }>
						{ this.translate( 'Contact %(transactionService)s Support', {
							args: {
								transactionService: transaction.service
							},
							context: 'transactionService is a website, such as WordPress.com.'
						} ) }
					</a>
					<a
						href="#"
						onClick={ this.recordClickEvent( 'Print Receipt Button in Billing History Receipt', this.printReceipt ) }
						className="button is-secondary"
					>
						{ this.translate( 'Print Receipt' ) }
					</a>
				</div>
			</div>
		);
	},

	ref: function() {
		if ( ! this.props.transaction.pay_part ) {
			return null;
		}

		return (
			<li>
				<strong>{ titleCase( this.props.transaction.pay_part ) } Ref</strong>
				<span>{ this.props.transaction.pay_ref }</span>
			</li>
		);
	},

	paymentMethod: function() {
		var transaction = this.props.transaction,
			text;

		if ( 'NOT STORED' === transaction.cc_type.toUpperCase() ) {
			text = this.translate( 'Credit Card' );
		} else {
			text = transaction.cc_type.toUpperCase() + this.translate( ' ending in ' ) + transaction.cc_num;
		}

		return (
			<li>
				<strong>{ this.translate( 'Payment Method' ) }</strong>
				<span>{ text }</span>
			</li>
		);
	},

	renderBillingDetails: function( transaction ) {
		if ( ! this.props.transaction.cc_name && ! this.props.transaction.cc_email ) {
			return null;
		}

		return (
			<li className="billing-details">
				<strong>{ this.translate( 'Billing Details' ) }</strong>
				<div contentEditable="true">{ transaction.cc_name }</div>
				<div contentEditable="true">{ transaction.cc_email }</div>
			</li>
		);
	},

	renderLineItems: function( transaction ) {
		var items, creditBadge;

		items = transaction.items.map( function( item ) {
			return (
				<tr key={ item.id }>
					<td className="receipt-item-name">
						<span>{ item.variation }</span>
						<small>({ item.type })</small><br />
						<em>{ item.domain }</em>
					</td>
					<td className={ 'receipt-amount ' + transaction.credit }>
						{ item.amount }
						{ transaction.credit ? creditBadge : '' }
					</td>
				</tr>
			);
		} );

		creditBadge = <span className="credit-badge">{ this.translate( 'Refund' ) }</span>;

		return (
			<div className="receipt">
				<h4>{ this.translate( 'Order Summary' ) }</h4>
				<table className="receipt-line-items">
					<thead>
						<tr>
							<th className="receipt-desc">{ this.translate( 'Description' ) }</th>
							<th className="receipt-amount">{ this.translate( 'Amount' ) }</th>
						</tr>
					</thead>
					<tfoot>
						<tr>
							<td className="receipt-desc">
								<strong>{ this.translate( 'Total' ) }:</strong>
							</td>
							<td className={ 'receipt-amount total-amount ' + transaction.credit }>
								{ transaction.amount }
							</td>
						</tr>
					</tfoot>
					<tbody>
						{ items }
					</tbody>
				</table>
			</div>
		);
	}
} );
